// kilocode_change start
import { plain } from "../kilocode/cli/logo"

// UI.logo() iterates `left`, so its length caps how many rows print. Derive it
// from the wordmark instead of hardcoding a row count that silently truncates
// the art whenever the logo changes height.
const wordmark = plain()

export const logo = {
  left: wordmark.map(() => ""),
  right: wordmark,
}
// kilocode_change end

export const go = {
  left: ["", "", "", ""], // kilocode_change
  right: ["", "", "", ""], // kilocode_change
}

export const marks = "_^~,"
