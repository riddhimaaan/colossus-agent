// kilocode_change - new file
const yes = new Set(["1", "true", "yes", "on"])
const no = new Set(["0", "false", "no", "off"])

// kilocode_change - Colossus wordmark.
//
// ANSI Shadow letterforms: the ╗╝╚═║╔ bevels are part of the glyph, drawn a
// step darker than the ██ faces so the word reads as extruded. That replaces
// the old `~` shadow-row trick, though the `_`/`^`/`~` markers stay supported
// by both renderers for any future art.
//
// Box-drawing and block glyphs are CP437-safe, so unlike the KILOCODE art this
// needs no reduced fallback — the sextants old Windows console, ConEmu, and
// ANSICON cannot render are gone. supports() still drives the exit banner.
const WORDMARK = [
  ` ██████╗  ██████╗ ██╗       ██████╗ ███████╗ ███████╗ ██╗   ██╗███████╗ `,
  `██╔════╝ ██╔═══██╗██║      ██╔═══██╗██╔════╝ ██╔════╝ ██║   ██║██╔════╝ `,
  `██║      ██║   ██║██║      ██║   ██║███████╗ ███████╗ ██║   ██║███████╗ `,
  `██║      ██║   ██║██║      ██║   ██║╚════██║ ╚════██║ ██║   ██║╚════██║ `,
  `╚██████╗ ╚██████╔╝███████╗ ╚██████╔╝███████║ ███████║ ╚██████╔╝███████║ `,
  ` ╚═════╝  ╚═════╝ ╚══════╝  ╚═════╝ ╚══════╝ ╚══════╝  ╚═════╝ ╚══════╝ `,
]

// COLO, for the narrower exit banner printed beside the session title.
const SHORT = [`████ ████ ██   ████ `, `██   █  █ ██   █  █ `, `████ ████ ████ ████ `]

const modern = {
  tui: WORDMARK,
  plain: WORDMARK,
  exit: SHORT,
}

const fallback = {
  tui: WORDMARK,
  plain: WORDMARK,
  exit: SHORT,
}

function flag(value: string | undefined) {
  const key = value?.toLowerCase()
  if (!key) return
  if (yes.has(key)) return true
  if (no.has(key)) return false
}

function windows(env: NodeJS.ProcessEnv) {
  if (env.WT_SESSION) return true
  if (env.TERM_PROGRAM === "vscode") return true
  if (env.WEZTERM_PANE) return true
  if (env.TERM_PROGRAM === "WezTerm") return true
  return false
}

export function supports(env = process.env, platform = process.platform) {
  const override = flag(env.KILO_UNICODE_LOGO)
  if (override !== undefined) return override
  if (env.TERM === "dumb") return false
  // Old Windows Console Host cannot render the sextant glyphs used by the modern logo.
  if (platform === "win32") return windows(env)
  if (env.ConEmuPID) return false
  if (env.ANSICON) return false
  return true
}

export function tui(env = process.env, platform = process.platform) {
  return supports(env, platform) ? modern.tui : fallback.tui
}

export function plain(env = process.env, platform = process.platform) {
  return supports(env, platform) ? modern.plain : fallback.plain
}

export function session(
  title: string,
  id: string | undefined,
  dim: string,
  normal: string,
  env = process.env,
  platform = process.platform,
) {
  const logo = supports(env, platform) ? modern.exit : fallback.exit
  return [``, `${logo[0]}${dim}${title}${normal}`, `${logo[1]}${dim}colossus -s ${id}${normal}`, logo[2]].join("\n")
}
