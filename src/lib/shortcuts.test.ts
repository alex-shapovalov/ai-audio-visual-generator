import { describe, expect, it } from "vitest"
import { sceneForKey } from "@/lib/shortcuts"
import { SCENES } from "@/lib/types"

describe("sceneForKey", () => {
  it("maps 1 to 5 to the five scenes in order", () => {
    expect(["1", "2", "3", "4", "5"].map(sceneForKey)).toEqual([...SCENES])
  })

  it.each(["0", "6", "9", "a", "A", "", " ", "Enter", "10", "11"])("ignores %j", (key) => {
    expect(sceneForKey(key)).toBeNull()
  })
})
