import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import path from "path"
import { Skill } from "../../src/skill"
import { BUILTIN_SKILLS } from "../../src/kilocode/skills/builtin"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(AppNodeBuilder.build(Skill.node), AppNodeBuilder.build(CrossSpawnSpawner.node)))

// Colossus ships no built-in skills: kilo-config documented Kilo's coding
// configuration surface, which the fork does not present to the user. All
// skills now come from the profile or the workspace, so the user can read
// every instruction the agent can load.
it.instance(
  "no skills are bundled into the binary",
  () =>
    Effect.gen(function* () {
      expect(BUILTIN_SKILLS).toEqual([])
      const skill = yield* Skill.Service
      const skills = yield* skill.all()
      expect(skills.filter((s) => s.location === Skill.BUILTIN_LOCATION)).toEqual([])
    }),
  { git: true },
)

it.instance(
  "an empty project discovers no skills at all",
  () =>
    Effect.gen(function* () {
      const skill = yield* Skill.Service
      expect(yield* skill.all()).toEqual([])
      expect(yield* skill.get("kilo-config")).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "a workspace skill is discovered and is not marked built-in",
  () =>
    Effect.gen(function* () {
      const instance = yield* TestInstance
      const dir = path.join(instance.directory, ".kilo", "skill", "storyboard")
      yield* Effect.promise(() =>
        Bun.write(
          path.join(dir, "SKILL.md"),
          `---
name: storyboard
description: Draft a storyboard from a rough outline.
---

# Storyboard

User-provided content.
`,
        ),
      )

      const skill = yield* Skill.Service
      const item = yield* skill.get("storyboard")
      expect(item).toBeDefined()
      expect(item!.description).toBe("Draft a storyboard from a rough outline.")
      expect(item!.location).not.toBe(Skill.BUILTIN_LOCATION)
      expect(item!.location).toContain(path.join("skill", "storyboard", "SKILL.md"))
    }),
  { git: true },
)
