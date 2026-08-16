import { Cause, DateTime, Effect, Layer, Option } from "effect"
import { SessionEvent } from "../event"
import { EventV2 } from "../../event"
import { LocationServiceMap } from "../../location-service-map"
import { makeGlobalNode } from "../../effect/app-node"
import { SessionRunCoordinator } from "../run-coordinator"
import { SessionRunner } from "../runner"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { SessionExecution } from "../execution"

// kilocode_change start - Turn a failure cause into one line a person can read.
// Clients show this directly, so a full stack trace would be worse than useless.
const describeCause = (cause: Cause.Cause<unknown>) => {
  const failure = Cause.findErrorOption(cause)
  if (Option.isSome(failure)) {
    const error = failure.value as { readonly message?: unknown }
    if (typeof error?.message === "string" && error.message.length > 0) return error.message
    if (typeof failure.value === "string" && failure.value.length > 0) return failure.value
  }
  const [first] = Cause.pretty(cause).split("\n")
  return first && first.length > 0 ? first : "The session run failed."
}

// Announce that a run died. Without this the failure is written to the log and
// nowhere else, so every client — TUI, SDK, desktop app — keeps waiting on a
// turn that will never produce anything.
//
// This must run *inside* the run's own location context: that is where the Event
// service the rest of the session publishes through lives, and where the event's
// location is inferred from. Published from the surrounding global scope instead,
// it reaches a different service and no subscriber ever sees it.
//
// Errors here are swallowed: reporting a failure must never raise a second one,
// and the log handler outside this context still records the original cause.
const publishRunFailure = (sessionID: SessionSchema.ID, cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    yield* events.publish(SessionEvent.RunFailed, {
      sessionID,
      timestamp: yield* DateTime.now,
      error: { type: "unknown", message: describeCause(cause) },
    })
  }).pipe(
    Effect.catchCause((publishFailure) =>
      Effect.logError("Failed to publish session run failure", publishFailure).pipe(
        Effect.annotateLogs({ sessionID }),
      ),
    ),
  )
// kilocode_change end

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
const layer = Layer.effect(
  SessionExecution.Service,
  Effect.gen(function* () {
    const store = yield* SessionStore.Service
    const locations = yield* LocationServiceMap.Service
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, SessionRunner.RunError>({
      drain: Effect.fnUntraced(function* (sessionID: SessionSchema.ID, force) {
        const session = yield* store.get(sessionID)
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        return yield* SessionRunner.Service.use((runner) => runner.run({ sessionID, force })).pipe(
          // kilocode_change - inside the provide below, so it publishes through
          // the location's own Event service
          Effect.tapCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.void : publishRunFailure(sessionID, cause))),
          Effect.provide(locations.get(session.location)),
          Effect.tapCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : Effect.logError("Failed to drain Session", cause).pipe(Effect.annotateLogs({ sessionID })),
          ),
        )
      }),
    })

    return SessionExecution.Service.of({
      active: coordinator.active,
      interrupt: coordinator.interrupt,
      resume: coordinator.run,
      wake: coordinator.wake,
    })
  }),
)

export const node = makeGlobalNode({
  service: SessionExecution.Service,
  layer,
  deps: [SessionStore.node, LocationServiceMap.node],
})

export * as SessionExecutionLocal from "./local"
