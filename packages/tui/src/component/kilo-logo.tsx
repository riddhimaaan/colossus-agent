// kilocode_change - new file
import { RGBA } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"
import { tui } from "@/kilocode/cli/logo"

// Shadow markers (rendered chars in parens):
// _ = full shadow cell (space with bg=shadow)
// ^ = letter top, shadow bottom (▀ with fg=letter, bg=shadow)
// ~ = shadow top only (▀ with fg=shadow)
const SHADOW_MARKER = /[_^~]/

// kilocode_change - bronze ramp, brightest at the top so the wordmark reads as
// lit from above. The Colossus of Rhodes was cast in bronze; the shadow row
// under the letters continues the darkest step.
const BRONZE = ["#FFD9A0", "#F0A94B", "#D4762A", "#A85320", "#8A4218", "#6B3312"]
// The ANSI Shadow bevel glyphs are the extruded side of each letter, so draw
// them two steps darker than the face on the same row.
const BEVEL = /[╗╝╚═║╔╠╣╦╩╬]/

export function KiloLogo() {
  const { theme } = useTheme()
  const logo = tui()

  // Split a run into face-coloured and bevel-coloured spans.
  const tone = (run: string, face: RGBA, edge: RGBA): JSX.Element[] => {
    const out: JSX.Element[] = []
    let buf = ""
    let bevel = false
    const flush = () => {
      if (!buf) return
      out.push(
        <text fg={bevel ? edge : face} selectable={false}>
          {buf}
        </text>,
      )
      buf = ""
    }
    for (const ch of run) {
      const isBevel = BEVEL.test(ch)
      if (isBevel !== bevel) {
        flush()
        bevel = isBevel
      }
      buf += ch
    }
    flush()
    return out
  }

  const renderLine = (line: string, row: number): JSX.Element[] => {
    // The shadow row sits past the end of the ramp; clamp it to the base tone.
    const face = RGBA.fromHex(BRONZE[Math.min(row, BRONZE.length - 1)])
    const edge = RGBA.fromHex(BRONZE[Math.min(row + 2, BRONZE.length - 1)])
    const yellow = face
    const shadow = tint(theme.background, RGBA.fromHex(BRONZE[BRONZE.length - 1]), 0.35)
    const elements: JSX.Element[] = []
    let i = 0

    while (i < line.length) {
      const rest = line.slice(i)
      const markerIndex = rest.search(SHADOW_MARKER)

      if (markerIndex === -1) {
        elements.push(...tone(rest, face, edge))
        break
      }

      if (markerIndex > 0) {
        elements.push(...tone(rest.slice(0, markerIndex), face, edge))
      }

      const marker = rest[markerIndex]
      switch (marker) {
        case "_":
          elements.push(
            <text fg={yellow} bg={shadow} selectable={false}>
              {" "}
            </text>,
          )
          break
        case "^":
          elements.push(
            <text fg={yellow} bg={shadow} selectable={false}>
              ▀
            </text>,
          )
          break
        case "~":
          elements.push(
            <text fg={shadow} selectable={false}>
              ▀
            </text>,
          )
          break
      }

      i += markerIndex + 1
    }

    return elements
  }

  return (
    <box>
      <For each={logo}>{(line, row) => <box flexDirection="row">{renderLine(line, row())}</box>}</For>
    </box>
  )
}
