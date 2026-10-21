import { describe, expect, it } from "vitest"
import { describeAudioError } from "@/audio/errors"

const named = (name: string) => new DOMException("raw browser text", name)

describe("describeAudioError", () => {
  it.each([
    ["NotAllowedError", /denied/i],
    ["NotFoundError", /no audio input/i],
    ["NotReadableError", /busy or unavailable/i],
    ["AbortError", /busy or unavailable/i],
    ["OverconstrainedError", /no longer available/i],
    ["SecurityError", /secure page/i],
    ["EncodingError", /decoded/i],
  ])("explains %s in plain language", (name, expected) => {
    expect(describeAudioError(named(name))).toMatch(expected)
  })

  it("passes through the message of an ordinary error", () => {
    expect(describeAudioError(new Error("The audio engine was disposed"))).toBe("The audio engine was disposed")
  })

  it("falls back to a generic message for anything else", () => {
    expect(describeAudioError("boom")).toMatch(/something went wrong/i)
    expect(describeAudioError(null)).toMatch(/something went wrong/i)
    expect(describeAudioError(new Error(""))).toMatch(/something went wrong/i)
  })

  it("does not treat inherited object keys as known errors", () => {
    expect(describeAudioError(named("constructor"))).toBe("raw browser text")
  })
})
