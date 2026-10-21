import { describe, expect, it } from "vitest"
import { sanitizeLook } from "@/lib/look-schema"
import { DEFAULT_LOOK } from "@/lib/palettes"
import { SCENES } from "@/lib/types"

const VALID_COLORS = ["#112233", "#abc", "#FFEEDD"]

describe("sanitizeLook", () => {
  it("accepts a fully valid look", () => {
    const look = sanitizeLook(
      {
        scene: "rift",
        colors: VALID_COLORS,
        mediaId: "clip",
        mediaMix: 0.25,
        strobe: true,
        warp: 0.9,
        kaleido: true,
      },
      ["clip"],
    )
    expect(look).toEqual({
      scene: "rift",
      colors: VALID_COLORS,
      mediaId: "clip",
      mediaMix: 0.25,
      strobe: true,
      warp: 0.9,
      kaleido: true,
    })
  })

  it.each([undefined, null, "portal", 42, []])("returns the fallback look for %j", (raw) => {
    expect(sanitizeLook(raw, [])).toEqual({ ...DEFAULT_LOOK, strobe: false, kaleido: false })
  })

  it.each(SCENES.filter((scene) => scene !== "media"))("accepts the %s scene", (scene) => {
    expect(sanitizeLook({ scene }, []).scene).toBe(scene)
  })

  it("falls back on an unknown scene", () => {
    expect(sanitizeLook({ scene: "kaleidoscope" }, []).scene).toBe(DEFAULT_LOOK.scene)
  })

  it.each([
    ["not an array", "#ffffff"],
    ["too few colors", ["#ffffff", "#000000"]],
    ["non-hex entry", ["#ffffff", "red", "#000000"]],
    ["hex without hash", ["ffffff", "000000", "111111"]],
    ["wrong length hex", ["#ffff", "#000000", "#111111"]],
    ["non-string entry", ["#ffffff", 5, "#000000"]],
  ])("falls back to the default palette: %s", (_name, colors) => {
    expect(sanitizeLook({ colors }, []).colors).toEqual(DEFAULT_LOOK.colors)
  })

  it("keeps only the first three colors when more are given", () => {
    const colors = ["#111111", "#222222", "#333333", "#444444"]
    expect(sanitizeLook({ colors }, []).colors).toEqual(["#111111", "#222222", "#333333"])
  })

  it("drops a mediaId that was not provided", () => {
    expect(sanitizeLook({ mediaId: "ghost" }, ["real"]).mediaId).toBeNull()
  })

  it("keeps a mediaId that was provided", () => {
    expect(sanitizeLook({ mediaId: "real" }, ["real"]).mediaId).toBe("real")
  })

  it("downgrades the media scene to portal when no valid media is chosen", () => {
    expect(sanitizeLook({ scene: "media", mediaId: "ghost" }, ["real"]).scene).toBe("portal")
    expect(sanitizeLook({ scene: "media" }, []).scene).toBe("portal")
  })

  it("keeps the media scene when valid media is chosen", () => {
    expect(sanitizeLook({ scene: "media", mediaId: "real" }, ["real"]).scene).toBe("media")
  })

  it.each([
    [5, 1],
    [-3, 0],
    [0.4, 0.4],
    ["0.7", 0.7],
    ["abc", DEFAULT_LOOK.warp],
    [Number.NaN, DEFAULT_LOOK.warp],
    [Number.POSITIVE_INFINITY, DEFAULT_LOOK.warp],
    [undefined, DEFAULT_LOOK.warp],
  ])("clamps warp %j to %j", (value, expected) => {
    expect(sanitizeLook({ warp: value }, []).warp).toBe(expected)
  })

  it("clamps mediaMix and falls back when it is not a number", () => {
    expect(sanitizeLook({ mediaMix: 9 }, []).mediaMix).toBe(1)
    expect(sanitizeLook({ mediaMix: -1 }, []).mediaMix).toBe(0)
    expect(sanitizeLook({ mediaMix: "loud" }, []).mediaMix).toBe(DEFAULT_LOOK.mediaMix)
  })

  it.each([["true"], [1], ["yes"], [null], [undefined]])(
    "treats strobe and kaleido %j as false",
    (value) => {
      const look = sanitizeLook({ strobe: value, kaleido: value }, [])
      expect(look.strobe).toBe(false)
      expect(look.kaleido).toBe(false)
    },
  )

  it("uses a custom fallback for missing fields", () => {
    const fallback = { ...DEFAULT_LOOK, scene: "grid" as const, warp: 0.1 }
    const look = sanitizeLook({}, [], fallback)
    expect(look.scene).toBe("grid")
    expect(look.warp).toBe(0.1)
  })
})
