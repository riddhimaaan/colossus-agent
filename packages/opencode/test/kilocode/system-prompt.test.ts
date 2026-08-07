import { describe, expect, test } from "bun:test"
import { SystemPrompt } from "../../src/session/system"
import { ProviderTest } from "../fake/provider"

import PROMPT_CREATIVE_CORE from "../../src/session/prompt/creative-core.txt"

describe("SystemPrompt.provider", () => {
  // Colossus ships exactly one operating prompt. The per-model prompt table
  // (anthropic/beast/codex/gemini/gpt/gpt55/kimi/ling/trinity) was removed so
  // that the prompt shown by `colossus prompt show` is the whole truth.
  test("returns no model-specific prompt regardless of prompt metadata", () => {
    for (const prompt of ["anthropic", "anthropic_without_todo", "beast", "codex", "gemini", "gpt55", "ling", "trinity"] as const) {
      expect(SystemPrompt.provider(ProviderTest.model({ prompt }))).toEqual([])
    }
  })

  test("returns no model-specific prompt for any model id heuristic", () => {
    for (const id of ["anthropic/claude-4-opus", "gpt-5.5", "gpt-5.1-codex", "gemini-2.5-pro", "ling-2", "kimi-k2"]) {
      const model = ProviderTest.model({
        prompt: undefined,
        api: { id, url: "https://example.com", npm: "@ai-sdk/openai" },
      })
      expect(SystemPrompt.provider(model)).toEqual([])
    }
  })
})

describe("SystemPrompt core prompt", () => {
  test("instructions and soul both resolve to the creative core prompt", () => {
    expect(SystemPrompt.instructions()).toBe(PROMPT_CREATIVE_CORE.trim())
    expect(SystemPrompt.soul()).toBe(PROMPT_CREATIVE_CORE.trim())
  })

  test("the core prompt does not assume a software engineering user", () => {
    expect(SystemPrompt.instructions()).toContain("Do not assume the user is doing software engineering")
    expect(SystemPrompt.instructions()).not.toContain("software engineering tasks")
  })

  test("`colossus prompt show` prints the same text the model receives", async () => {
    // The launcher cats this file verbatim; a divergence would break the
    // transparency claim in the README.
    const shown = await Bun.file(
      new URL("../../src/session/prompt/creative-core.txt", import.meta.url).pathname,
    ).text()
    expect(shown.trim()).toBe(SystemPrompt.instructions())
  })
})
