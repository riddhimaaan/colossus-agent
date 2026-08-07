import { describe, expect, test } from "bun:test"
import { plain, session, supports, tui } from "../../src/kilocode/cli/logo"

describe("colossus logo", () => {
  test("allows remote terminals", () => {
    expect(supports({ SSH_TTY: "/dev/pts/0" }, "linux")).toBe(true)
    expect(supports({ SSH_CLIENT: "127.0.0.1 12345 22" }, "linux")).toBe(true)
    expect(supports({ SSH_CONNECTION: "127.0.0.1 12345 127.0.0.1 22" }, "linux")).toBe(true)
  })

  test("falls back on old Windows terminals", () => {
    expect(supports({}, "win32")).toBe(false)
    expect(supports({ ANSICON: "1" }, "win32")).toBe(false)
    expect(supports({ ConEmuPID: "123" }, "win32")).toBe(false)
  })

  test("allows modern Windows terminals", () => {
    expect(supports({ WT_SESSION: "session" }, "win32")).toBe(true)
    expect(supports({ TERM_PROGRAM: "vscode" }, "win32")).toBe(true)
    expect(supports({ WEZTERM_PANE: "1" }, "win32")).toBe(true)
    expect(supports({ TERM_PROGRAM: "WezTerm" }, "win32")).toBe(true)
  })

  test("allows an override", () => {
    expect(supports({ KILO_UNICODE_LOGO: "1", SSH_TTY: "/dev/pts/0" }, "linux")).toBe(true)
    expect(supports({ KILO_UNICODE_LOGO: "0" }, "linux")).toBe(false)
  })

  // kilocode_change - the Colossus wordmark uses only CP437-safe glyphs, so no
  // reduced variant is needed: every terminal gets the same art.
  test("uses glyphs every terminal can render", () => {
    for (const variant of [tui({ KILO_UNICODE_LOGO: "1" }, "linux"), tui({}, "win32"), plain({}, "win32")]) {
      const text = variant.join("\n")
      expect(text).not.toContain("🬺🬏")
      expect(text).not.toContain("🬁🬬")
      expect(/^[█~ ]+$/.test(text.replace(/\n/g, ""))).toBe(true)
    }
  })

  test("renders the Colossus wordmark with a shadow row in the TUI variant", () => {
    const modern = tui({ KILO_UNICODE_LOGO: "1" }, "linux")
    expect(modern).toHaveLength(6)
    expect(modern.at(-1)).toContain("~")
    // plain drops the shadow, so nothing prints a stray tilde outside the TUI
    expect(plain({}, "win32")).toHaveLength(5)
    expect(plain({}, "win32").join("")).not.toContain("~")
  })

  test("formats child session exit logo", () => {
    const out = session("Title", "ses_test", "<dim>", "<reset>", {}, "win32")
    expect(out).toContain("<dim>Title<reset>")
    expect(out).not.toContain("🬺🬏")
  })
})
