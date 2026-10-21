import { describe, expect, it } from "vitest"
import { heuristicLook } from "@/lib/look-heuristic"
import { PALETTES } from "@/lib/palettes"
import type { LookRequest } from "@/lib/look-schema"

const palette = (id: string) => PALETTES.find((entry) => entry.id === id)?.colors

const MEDIA = [
  { id: "logo", name: "logo.png" },
  { id: "loop", name: "loop.mp4" },
]

const ask = (request: Partial<LookRequest>) => heuristicLook({ media: [], ...request }).look

describe("heuristicLook genres", () => {
  it("maps dubstep words to the rift scene with strobe and heavy warp", () => {
    const look = ask({ prompt: "filthy dubstep drop" })
    expect(look.scene).toBe("rift")
    expect(look.colors).toEqual(palette("dubstep"))
    expect(look.strobe).toBe(true)
    expect(look.warp).toBe(0.8)
  })

  it("maps techno words to the strobe scene in monochrome", () => {
    const look = ask({ title: "Warehouse Techno 02" })
    expect(look.scene).toBe("strobe")
    expect(look.colors).toEqual(palette("mono"))
    expect(look.strobe).toBe(true)
  })

  it("maps house words to the grid scene without strobe", () => {
    const look = ask({ title: "Deep Tech House Groove" })
    expect(look.scene).toBe("grid")
    expect(look.colors).toEqual(palette("house"))
    expect(look.strobe).toBe(false)
  })

  it("maps trance words to the portal scene", () => {
    const look = ask({ prompt: "uplifting melodic trance" })
    expect(look.scene).toBe("portal")
    expect(look.colors).toEqual(palette("trance"))
    expect(look.strobe).toBe(false)
  })

  it("matches case-insensitively across title and prompt", () => {
    expect(ask({ title: "RIDDIM", prompt: "" }).scene).toBe("rift")
    expect(ask({ title: "Untitled", prompt: "TRANCE" }).scene).toBe("portal")
  })
})

describe("heuristicLook newer scenes", () => {
  it.each([
    ["live equalizer spectrum", "bars", "synthwave"],
    ["ambient chill set", "aurora", "abyss"],
    ["hyperspace through the stars", "warp", "ice"],
    ["festival laser show", "lasers", "synthwave"],
    ["psychedelic mandala", "bloom", "royal"],
  ])("maps %j to the %s scene without strobe", (prompt, scene, paletteId) => {
    const look = ask({ prompt })
    expect(look.scene).toBe(scene)
    expect(look.colors).toEqual(palette(paletteId))
    expect(look.strobe).toBe(false)
  })

  it("keeps the established genres ahead of the newer words", () => {
    expect(ask({ prompt: "dubstep in space" }).scene).toBe("rift")
    expect(ask({ prompt: "trance with lasers" }).scene).toBe("portal")
    expect(ask({ prompt: "chill house" }).scene).toBe("grid")
  })

  it.each(["sunbars", "mystars", "psycho", "predmaker"])("matches the short words only as whole words: %j", (prompt) => {
    expect(ask({ prompt }).scene).toBe("portal")
  })
})

describe("heuristicLook track stats", () => {
  it("chooses rift for very bass-heavy tracks with no genre words", () => {
    const look = ask({ title: "untitled", stats: { duration: 200, bass: 0.8, brightness: 0.01 } })
    expect(look.scene).toBe("rift")
    expect(look.strobe).toBe(true)
    expect(look.warp).toBe(0.7)
  })

  it("chooses grid for bright tracks with no genre words", () => {
    const look = ask({ title: "untitled", stats: { duration: 200, bass: 0.3, brightness: 0.09 } })
    expect(look.scene).toBe("grid")
    expect(look.colors).toEqual(palette("house"))
  })

  it("falls back to a trance portal when nothing matches", () => {
    const look = ask({ title: "untitled", stats: { duration: 200, bass: 0.3, brightness: 0.01 } })
    expect(look.scene).toBe("portal")
    expect(look.colors).toEqual(palette("trance"))
  })

  it("prefers genre words over stats", () => {
    const look = ask({ title: "minimal", stats: { duration: 200, bass: 0.95, brightness: 0.01 } })
    expect(look.scene).toBe("grid")
  })
})

describe("heuristicLook colors", () => {
  it.each([
    ["make it fire", "ember"],
    ["acid green", "dubstep"],
    ["icy blue", "trance"],
    ["warm amber", "house"],
    ["black and white", "mono"],
    ["sunset vibes", "sunset"],
    ["arctic frost", "ice"],
    ["toxic waste", "toxic"],
    ["royal court", "royal"],
    ["crimson tide", "crimson"],
    ["retro synthwave", "synthwave"],
    ["underwater glow", "abyss"],
  ])("maps %j to the %s palette", (prompt, id) => {
    expect(ask({ prompt }).colors).toEqual(palette(id))
  })

  it("lets color words override the genre palette but keep its scene", () => {
    const look = ask({ prompt: "dubstep in fire colors" })
    expect(look.scene).toBe("rift")
    expect(look.colors).toEqual(palette("ember"))
  })
})

describe("heuristicLook media", () => {
  it("uses the first media item full-frame when the prompt asks for it", () => {
    const look = ask({ prompt: "show my logo", media: MEDIA })
    expect(look.scene).toBe("media")
    expect(look.mediaId).toBe("logo")
    expect(look.mediaMix).toBe(0.9)
  })

  it("ignores media words when no media exists", () => {
    const look = ask({ prompt: "show my logo", media: [] })
    expect(look.scene).not.toBe("media")
    expect(look.mediaId).toBeNull()
    expect(look.mediaMix).toBe(0.5)
  })

  it("does not use media unless asked", () => {
    const look = ask({ prompt: "trance", media: MEDIA })
    expect(look.mediaId).toBeNull()
  })

  it("matches media words only as whole words", () => {
    expect(ask({ prompt: "mymedia mystery", media: MEDIA }).mediaId).toBeNull()
  })
})

describe("heuristicLook flags and metadata", () => {
  it.each(["kaleidoscope", "mirror it", "fractal"])("enables kaleido for %j", (prompt) => {
    expect(ask({ prompt }).kaleido).toBe(true)
  })

  it("leaves kaleido off by default", () => {
    expect(ask({ prompt: "trance" }).kaleido).toBe(false)
  })

  it("reports the heuristic source and a reason", () => {
    const response = heuristicLook({ prompt: "trance", media: [] })
    expect(response.source).toBe("heuristic")
    expect(response.reason).not.toBe("")
  })

  it("handles an empty request", () => {
    const look = ask({})
    expect(look.scene).toBe("portal")
    expect(look.colors).toEqual(palette("trance"))
  })
})
