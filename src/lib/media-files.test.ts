import { describe, expect, it } from "vitest"
import { LARGE_IMAGE_BYTES, LARGE_VIDEO_BYTES, isLargeMedia, mediaKindOf } from "@/lib/media-files"

describe("mediaKindOf", () => {
  it.each([
    ["image/png", "image"],
    ["image/jpeg", "image"],
    ["image/gif", "image"],
    ["video/mp4", "video"],
    ["video/webm", "video"],
    ["audio/mpeg", null],
    ["application/pdf", null],
    ["text/plain", null],
    ["", null],
  ])("classifies %j as %j", (type, expected) => {
    expect(mediaKindOf({ type })).toBe(expected)
  })
})

describe("isLargeMedia", () => {
  it("warns above the limit and not at it", () => {
    expect(isLargeMedia("image", LARGE_IMAGE_BYTES)).toBe(false)
    expect(isLargeMedia("image", LARGE_IMAGE_BYTES + 1)).toBe(true)
    expect(isLargeMedia("video", LARGE_VIDEO_BYTES)).toBe(false)
    expect(isLargeMedia("video", LARGE_VIDEO_BYTES + 1)).toBe(true)
  })

  it("tolerates videos that would be too large for an image", () => {
    expect(isLargeMedia("video", LARGE_IMAGE_BYTES + 1)).toBe(false)
  })
})
