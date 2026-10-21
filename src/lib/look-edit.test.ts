import { describe, expect, it } from "vitest"
import { withMedia, withScene, withoutMedia } from "@/lib/look-edit"
import { DEFAULT_LOOK } from "@/lib/palettes"
import type { Look } from "@/lib/types"

const look = (overrides: Partial<Look> = {}): Look => ({ ...DEFAULT_LOOK, ...overrides })

describe("withScene", () => {
  it("switches scenes without touching the media choice", () => {
    expect(withScene(look({ mediaId: "clip" }), "rift", ["clip", "other"])).toEqual(
      look({ scene: "rift", mediaId: "clip" }),
    )
  })

  it("picks the first media item for the media scene when none is chosen", () => {
    expect(withScene(look(), "media", ["first", "second"]).mediaId).toBe("first")
  })

  it("keeps an already chosen media item for the media scene", () => {
    expect(withScene(look({ mediaId: "second" }), "media", ["first", "second"]).mediaId).toBe("second")
  })

  it("leaves the media id empty when there is no media to use", () => {
    const result = withScene(look(), "media", [])
    expect(result.scene).toBe("media")
    expect(result.mediaId).toBeNull()
  })
})

describe("withMedia", () => {
  it("sets the media item", () => {
    expect(withMedia(look(), "clip").mediaId).toBe("clip")
  })

  it("falls back to portal when clearing media on the media scene", () => {
    const result = withMedia(look({ scene: "media", mediaId: "clip" }), null)
    expect(result.scene).toBe("portal")
    expect(result.mediaId).toBeNull()
  })

  it("keeps the scene when clearing media elsewhere", () => {
    expect(withMedia(look({ scene: "grid", mediaId: "clip" }), null).scene).toBe("grid")
  })
})

describe("withoutMedia", () => {
  it("returns the same look when another item was removed", () => {
    const current = look({ mediaId: "clip" })
    expect(withoutMedia(current, "other")).toBe(current)
  })

  it("drops the removed item and leaves the media scene", () => {
    const result = withoutMedia(look({ scene: "media", mediaId: "clip" }), "clip")
    expect(result).toMatchObject({ scene: "portal", mediaId: null })
  })

  it("drops the removed item but keeps a generated scene", () => {
    const result = withoutMedia(look({ scene: "rift", mediaId: "clip" }), "clip")
    expect(result).toMatchObject({ scene: "rift", mediaId: null })
  })
})
