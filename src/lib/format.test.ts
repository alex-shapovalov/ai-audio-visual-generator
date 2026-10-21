import { describe, expect, it } from "vitest"
import { formatDuration, titleFromFileName } from "@/lib/format"

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [9, "0:09"],
    [59.6, "1:00"],
    [61, "1:01"],
    [312, "5:12"],
    [3725, "62:05"],
    [-4, "0:00"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})

describe("titleFromFileName", () => {
  it.each([
    ["Warehouse 126.mp3", "Warehouse 126"],
    ["archive.tar.gz", "archive.tar"],
    ["  spaced name .wav", "spaced name"],
    ["no-extension", "no-extension"],
    [".hidden", ".hidden"],
    ["dir.name/track.flac", "dir.name/track"],
  ])("turns %j into %j", (name, expected) => {
    expect(titleFromFileName(name)).toBe(expected)
  })
})
