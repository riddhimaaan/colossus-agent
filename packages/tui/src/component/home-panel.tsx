// kilocode_change - new file
//
// Startup inventory panel. Shows what this Colossus can actually do right now:
// the model it will use, where it is working, and the skills, commands, agents,
// and MCP servers currently loaded.
//
// Tools are deliberately absent. There is no endpoint that reports the resolved
// tool list for an agent, and inventing one from permission rules would print a
// list that does not match what the model is really given.
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { TextAttributes } from "@opentui/core"
import { createMemo, createResource, For, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useLocal } from "../context/local"
import { useProject } from "../context/project"

const MAX_PER_GROUP = 8
const LABEL_WIDTH = 12

/** Collapse a home path to `~` so the panel does not wrap on long paths. */
function shorten(dir: string, home: string | undefined) {
  if (!dir) return ""
  if (home && dir.startsWith(home)) return "~" + dir.slice(home.length)
  return dir
}

/**
 * Skills carry no category, so group by where they came from: the global
 * profile, this workspace, or a plugin. That is real provenance rather than a
 * label invented for display.
 */
function sourceOf(location: string) {
  if (/[\\/]\.kilo(code)?[\\/]/.test(location)) return "workspace"
  if (/node_modules|[\\/]plugin[\\/]/.test(location)) return "plugin"
  return "global"
}

export function HomePanel() {
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const project = useProject()

  const [skills] = createResource(() =>
    sdk.client.app
      .skills({}, { throwOnError: true })
      .then((result) => result.data ?? [])
      // Never let a rejected resource reach the memo: reading it in an errored
      // state re-throws and would tear down the whole home screen.
      .catch(() => [] as { name: string; location?: string }[]),
  )

  const groups = createMemo(() => {
    const list = skills() ?? []
    const by = new Map<string, string[]>()
    for (const skill of list) {
      const key = sourceOf(skill.location ?? "")
      if (!by.has(key)) by.set(key, [])
      by.get(key)!.push(skill.name)
    }
    return [...by.entries()]
      .map(([label, names]) => [label, names.sort((a, b) => a.localeCompare(b))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
  })

  // Skills and MCP prompts are also surfaced as slash-commands. Counting them
  // here would double-count every skill, so keep only real commands.
  const commands = createMemo(() =>
    (sync.data.command ?? [])
      .filter((item) => item.source !== "skill" && item.source !== "mcp")
      .map((item) => item.name)
      .sort(),
  )
  const agents = createMemo(() =>
    (sync.data.agent ?? [])
      .filter((item) => item.hidden !== true)
      .map((item) => item.name)
      .sort(),
  )
  const mcp = createMemo(() => Object.keys(sync.data.mcp ?? {}).sort())
  const skillCount = createMemo(() => (skills() ?? []).length)

  // parsed() carries the display names and has a sensible fallback before the
  // model store is ready; current() is undefined at that point.
  const model = createMemo(() => {
    const parsed = local.model.parsed()
    return `${parsed.model} · ${parsed.provider}`
  })

  const summary = createMemo(() =>
    [
      `${skillCount()} skill${skillCount() === 1 ? "" : "s"}`,
      `${commands().length} command${commands().length === 1 ? "" : "s"}`,
      `${mcp().length} MCP server${mcp().length === 1 ? "" : "s"}`,
      "/help for commands",
    ].join(" · "),
  )

  // One row per group, truncated so a large library cannot push the prompt off
  // screen. The count always reflects the full set, not what is displayed.
  // Fixed-width label column: keeps labels aligned like the meta rows above and
  // stops a long value list from running into its own label when it wraps.
  const row = (label: string, items: string[]) => (
    <Show when={items.length > 0}>
      <box flexDirection="row">
        <text fg={theme.textMuted}>{label.padEnd(LABEL_WIDTH)}</text>
        <box flexGrow={1}>
          <text fg={theme.text}>
            {items.slice(0, MAX_PER_GROUP).join(", ")}
            {items.length > MAX_PER_GROUP ? `, +${items.length - MAX_PER_GROUP} more` : ""}
          </text>
        </box>
      </box>
    </Show>
  )

  const meta = (label: string, value: string) => (
    <box flexDirection="row">
      <text fg={theme.textMuted}>{label.padEnd(LABEL_WIDTH)}</text>
      <box flexGrow={1}>
        <text fg={theme.text}>{value}</text>
      </box>
    </box>
  )

  const heading = (label: string) => (
    <text fg={theme.accent} attributes={TextAttributes.BOLD}>
      {label}
    </text>
  )

  return (
    <box
      borderStyle="rounded"
      borderColor={theme.borderSubtle}
      title={`Colossus ${InstallationVersion}`}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
    >
      {heading("Session")}
      {meta("model", model())}
      {meta("folder", shorten(project.instance.directory(), process.env["HOME"]))}

      <box height={1} />
      {heading("Available Skills")}
      <For each={groups()}>{([label, names]) => row(label, names)}</For>
      <Show when={!skills.loading && skillCount() === 0}>
        <text fg={theme.textMuted}>{"none yet — add them under ~/.config/colossus/skills/"}</text>
      </Show>

      <Show when={commands().length > 0 || agents().length > 0 || mcp().length > 0}>
        <box height={1} />
        {heading("Available Commands")}
        {row("commands", commands())}
        {row("agents", agents())}
        {row("mcp", mcp())}
      </Show>

      <box height={1} />
      <text fg={theme.textMuted}>{summary()}</text>
    </box>
  )
}
