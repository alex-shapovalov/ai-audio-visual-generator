import { describe, expect, it } from "vitest"
import { SCENES } from "@/lib/types"
import { FRAGMENT, SCENE_INDEX } from "@/visuals/shaders"

describe("scene shaders", () => {
  it("gives every scene its own program index", () => {
    const indexes = SCENES.map((scene) => SCENE_INDEX[scene])
    expect(new Set(indexes).size).toBe(SCENES.length)
    expect(indexes.every((index) => Number.isInteger(index) && index >= 0)).toBe(true)
  })

  it("selects a drawing function for every scene except media", () => {
    for (const scene of SCENES.filter((entry) => entry !== "media")) {
      expect(FRAGMENT, scene).toContain(`SCENE == ${SCENE_INDEX[scene]}`)
    }
  })

  it("leaves the media index to the plain backdrop", () => {
    expect(FRAGMENT).not.toContain(`SCENE == ${SCENE_INDEX.media}`)
  })
})
