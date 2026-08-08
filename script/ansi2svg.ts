// Replay a captured ANSI stream into a screen grid, then emit that grid as SVG.
//
// This exists because no terminal-screenshot tool is installed on this machine.
// Rather than hand-drawing a mockup of the UI, this interprets the real bytes
// the program wrote to its pty, so the picture is what actually rendered.
//
// Usage: bun ansi2svg.ts <input.ansi> <output.svg> [cols] [rows] [--no-alt]
import { readFileSync, writeFileSync } from "fs"

const [, , inPath, outPath, colsArg, rowsArg, ...rest] = process.argv
const COLS = Number(colsArg ?? 100)
const ROWS = Number(rowsArg ?? 34)
// The TUI draws on the alternate screen; plain CLI output does not.
const useAlt = !rest.includes("--no-alt")

const DEFAULT_FG = "#e6e6e6"
const DEFAULT_BG = "#0e0e10"

type Cell = { ch: string; fg: string | null; bg: string | null; bold: boolean }
const blank = (): Cell => ({ ch: " ", fg: null, bg: null, bold: false })
const makeGrid = () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, blank))

let primary = makeGrid()
let alt = makeGrid()
let grid = primary
let onAlt = false

let row = 0
let col = 0
let fg: string | null = null
let bg: string | null = null
let bold = false

// xterm 256-colour palette, for the non-truecolor fallback path in ui.ts.
const BASE16 = [
  "#000000", "#cd0000", "#00cd00", "#cdcd00", "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
  "#7f7f7f", "#ff0000", "#00ff00", "#ffff00", "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
]
const hex = (n: number) => n.toString(16).padStart(2, "0")
function xterm256(n: number): string {
  if (n < 16) return BASE16[n]
  if (n < 232) {
    const i = n - 16
    const steps = [0, 95, 135, 175, 215, 255]
    return `#${hex(steps[Math.floor(i / 36) % 6])}${hex(steps[Math.floor(i / 6) % 6])}${hex(steps[i % 6])}`
  }
  const v = 8 + (n - 232) * 10
  return `#${hex(v)}${hex(v)}${hex(v)}`
}

function sgr(params: number[]) {
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (p === 0) { fg = null; bg = null; bold = false }
    else if (p === 1) bold = true
    else if (p === 22) bold = false
    else if (p >= 30 && p <= 37) fg = BASE16[p - 30]
    else if (p >= 90 && p <= 97) fg = BASE16[p - 90 + 8]
    else if (p >= 40 && p <= 47) bg = BASE16[p - 40]
    else if (p >= 100 && p <= 107) bg = BASE16[p - 100 + 8]
    else if (p === 39) fg = null
    else if (p === 49) bg = null
    else if (p === 38 || p === 48) {
      const mode = params[i + 1]
      let colour: string | null = null
      if (mode === 2) { colour = `#${hex(params[i + 2] & 255)}${hex(params[i + 3] & 255)}${hex(params[i + 4] & 255)}`; i += 4 }
      else if (mode === 5) { colour = xterm256(params[i + 2]); i += 2 }
      if (p === 38) fg = colour; else bg = colour
    }
  }
}

function put(ch: string) {
  if (row < 0 || row >= ROWS) return
  if (col >= COLS) return
  grid[row][col] = { ch, fg, bg, bold }
  col++
}

function eraseLine(mode: number) {
  if (row < 0 || row >= ROWS) return
  const from = mode === 0 ? col : 0
  const to = mode === 1 ? col + 1 : COLS
  for (let c = from; c < to && c < COLS; c++) grid[row][c] = { ...blank(), bg }
}

function eraseDisplay(mode: number) {
  if (mode === 2 || mode === 3) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = { ...blank(), bg }
    return
  }
  const from = mode === 0 ? row : 0
  const to = mode === 1 ? row + 1 : ROWS
  for (let r = from; r < to; r++) for (let c = 0; c < COLS; c++) grid[r][c] = { ...blank(), bg }
}

const data = readFileSync(inPath, "utf8")
let i = 0
while (i < data.length) {
  const ch = data[i]

  if (ch === "\x1b") {
    const next = data[i + 1]
    if (next === "[") {
      // CSI: parameters, then a final byte in @-~
      let j = i + 2
      while (j < data.length && !/[@-~]/.test(data[j])) j++
      const body = data.slice(i + 2, j)
      const final = data[j]
      const priv = body.startsWith("?") || body.startsWith(">") || body.startsWith("<") || body.startsWith("=")
      const nums = body.replace(/^[?><=]/, "").split(";").map((s) => (s === "" ? 0 : parseInt(s, 10) || 0))

      if (priv) {
        // Private modes: only the alternate-screen switch changes what we draw.
        if (final === "h" && (nums[0] === 1049 || nums[0] === 47) && useAlt) { onAlt = true; grid = alt; row = 0; col = 0 }
        if (final === "l" && (nums[0] === 1049 || nums[0] === 47) && useAlt) { onAlt = false; grid = primary }
      } else {
        switch (final) {
          case "H": case "f": row = (nums[0] || 1) - 1; col = (nums[1] || 1) - 1; break
          case "A": row -= nums[0] || 1; break
          case "B": row += nums[0] || 1; break
          case "C": col += nums[0] || 1; break
          case "D": col -= nums[0] || 1; break
          case "G": col = (nums[0] || 1) - 1; break
          case "d": row = (nums[0] || 1) - 1; break
          case "J": eraseDisplay(nums[0] || 0); break
          case "K": eraseLine(nums[0] || 0); break
          case "m": sgr(nums); break
        }
      }
      i = j + 1
      continue
    }
    if (next === "]") {
      // OSC: runs to BEL or ST.
      let j = i + 2
      while (j < data.length && data[j] !== "\x07" && !(data[j] === "\x1b" && data[j + 1] === "\\")) j++
      i = data[j] === "\x07" ? j + 1 : j + 2
      continue
    }
    if (next === "P" || next === "X" || next === "^" || next === "_") {
      let j = i + 2
      while (j < data.length && !(data[j] === "\x1b" && data[j + 1] === "\\")) j++
      i = j + 2
      continue
    }
    i += 2
    continue
  }

  if (ch === "\n") { row++; i++; continue }
  if (ch === "\r") { col = 0; i++; continue }
  if (ch === "\t") { col = (Math.floor(col / 8) + 1) * 8; i++; continue }
  if (ch === "\x08") { col = Math.max(0, col - 1); i++; continue }
  if (ch < " ") { i++; continue }

  // Combine surrogate pairs so an astral character occupies one cell.
  const cp = data.codePointAt(i)!
  const str = String.fromCodePoint(cp)
  put(str)
  i += str.length
}

const out = useAlt && onAlt ? alt : grid

// Trim blank rows and columns so the image has no dead margin.
const used = (r: Cell[]) => r.some((c) => c.ch.trim() !== "" || c.bg)
let top = 0, bottom = ROWS - 1
while (top < ROWS && !used(out[top])) top++
while (bottom > top && !used(out[bottom])) bottom--
let right = 0
for (let r = top; r <= bottom; r++) for (let c = 0; c < COLS; c++) if (out[r][c].ch.trim() !== "" || out[r][c].bg) right = Math.max(right, c)

const CW = 8.4, CH = 18, PAD = 16, FS = 14
const w = Math.round((right + 1) * CW + PAD * 2)
const h = Math.round((bottom - top + 1) * CH + PAD * 2)

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const parts: string[] = []
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono',monospace" font-size="${FS}">`)
parts.push(`<rect width="${w}" height="${h}" rx="8" fill="${DEFAULT_BG}"/>`)

// Background runs first, so glyphs draw on top of them.
for (let r = top; r <= bottom; r++) {
  let c = 0
  while (c <= right) {
    const cell = out[r][c]
    if (!cell.bg) { c++; continue }
    let end = c
    while (end + 1 <= right && out[r][end + 1].bg === cell.bg) end++
    const x = PAD + c * CW, y = PAD + (r - top) * CH
    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${((end - c + 1) * CW).toFixed(1)}" height="${CH}" fill="${cell.bg}"/>`)
    c = end + 1
  }
}

for (let r = top; r <= bottom; r++) {
  let c = 0
  while (c <= right) {
    const cell = out[r][c]
    if (cell.ch.trim() === "") { c++; continue }
    let end = c
    let run = cell.ch
    while (end + 1 <= right) {
      const n = out[r][end + 1]
      if (n.fg !== cell.fg || n.bold !== cell.bold || n.ch === "") break
      if (n.ch.trim() === "" && !n.bg) break
      run += n.ch
      end++
    }
    // One x per glyph. textLength would stretch a run to fit, which shears the
    // box-drawing bevels out of alignment with the block faces beside them;
    // pinning every cell keeps the art correct in whatever font renders it.
    const xs: string[] = []
    for (let k = 0; k < run.length; k++) xs.push((PAD + (c + k) * CW).toFixed(1))
    const y = PAD + (r - top) * CH + FS
    const fill = cell.fg ?? DEFAULT_FG
    const weight = cell.bold ? ` font-weight="bold"` : ""
    parts.push(
      `<text x="${xs.join(" ")}" y="${y.toFixed(1)}" fill="${fill}"${weight} xml:space="preserve">${esc(run)}</text>`,
    )
    c = end + 1
  }
}
parts.push(`</svg>`)

writeFileSync(outPath, parts.join("\n"))
console.log(`wrote ${outPath}  ${w}x${h}  rows ${top}..${bottom}  cols 0..${right}  alt=${onAlt}`)
