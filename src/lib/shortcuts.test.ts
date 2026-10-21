import { describe, expect, it } from "vitest"
import { SCENE_KEYS, sceneForKey } from "@/lib/shortcuts"
import { SCENES } from "@/lib/types"

describe("sceneForKey", () => {
  it("maps 1 to 9 and then 0 to the scenes in order", () => {
    expect(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(sceneForKey)).toEqual([...SCENES])
  })

  it.each(["a", "A", "", " ", "Enter", "10", "11", "-"])("ignores %j", (key) => {
    expect(sceneForKey(key)).toBeNull()
  })
})

describe("SCENE_KEYS", () => {
  it("has one distinct key for every scene", () => {
    expect(SCENE_KEYS).toHaveLength(SCENES.length)
    expect(new Set(SCENE_KEYS).size).toBe(SCENES.length)
  })
})
