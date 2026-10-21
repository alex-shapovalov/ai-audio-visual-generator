import { describe, expect, it } from "vitest"
import { DEFAULT_LOOK, PALETTES, hexToRgb } from "@/lib/palettes"
import { emptyFrame, type Frame, type Look } from "@/lib/types"
import { LookState } from "@/visuals/look-state"

const FRAME_MS = 1000 / 60

const frameWith = (overrides: Partial<Frame> = {}): Frame => ({ ...emptyFrame(), ...overrides })

const lookWith = (overrides: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...overrides })

const run = (
  state: LookState,
  fromMs: number,
  durationMs: number,
  frame: Frame,
  frameMs = FRAME_MS,
) => {
  let now = fromMs
  while (now < fromMs + durationMs) {
    state.advance(now, frame)
    now += frameMs
  }
  return now
}

const startedAt = (now: number) => {
  const state = new LookState()
  state.advance(now, frameWith())
  return state
}

describe("scene changes", () => {
  it("wait for the next kick edge while the other parameters apply at once", () => {
    const state = startedAt(1000)
    state.setLook(lookWith({ scene: "rift", strobe: true, warp: 0.9 }), false, 1000)

    state.advance(1016, frameWith({ kick: 0.2 }))
    expect(state.scene).toBe("portal")
    expect(state.look.strobe).toBe(true)

    state.advance(1033, frameWith({ kick: 0.95 }))
    expect(state.scene).toBe("rift")
  })

  it("switch after 700 ms even if no kick arrives", () => {
    const state = startedAt(1000)
    state.setLook(lookWith({ scene: "grid" }), false, 1000)

    run(state, 1016, 650, frameWith({ kick: 0.1 }))
    expect(state.scene).toBe("portal")

    run(state, 1700, 100, frameWith({ kick: 0.1 }))
    expect(state.scene).toBe("grid")
  })

  it("ignore a kick that is already above the threshold", () => {
    const state = startedAt(1000)
    state.advance(1016, frameWith({ kick: 0.95 }))
    state.setLook(lookWith({ scene: "grid" }), false, 1016)

    state.advance(1033, frameWith({ kick: 0.96 }))
    expect(state.scene).toBe("portal")
  })

  it("switch at once when the change is immediate and drop any pending switch", () => {
    const state = startedAt(1000)
    state.setLook(lookWith({ scene: "rift" }), false, 1000)
    state.setLook(lookWith({ scene: "grid" }), true, 1010)
    expect(state.scene).toBe("grid")

    state.advance(1033, frameWith({ kick: 0.95 }))
    expect(state.scene).toBe("grid")
  })

  it("are cancelled by a later look that keeps the current scene", () => {
    const state = startedAt(1000)
    state.setLook(lookWith({ scene: "rift" }), false, 1000)
    state.setLook(lookWith({ scene: "portal", warp: 0.1 }), false, 1010)

    state.advance(1033, frameWith({ kick: 0.95 }))
    run(state, 1050, 1000, frameWith())
    expect(state.scene).toBe("portal")
  })
})

describe("per-frame motion", () => {
  it("opens in a breakdown and closes again afterwards", () => {
    const state = startedAt(0)
    const afterBreakdown = run(state, 16, 1500, frameWith({ section: "breakdown" }))
    expect(state.open).toBeGreaterThan(0.9)

    run(state, afterBreakdown, 2000, frameWith({ section: "groove" }))
    expect(state.open).toBeLessThan(0.1)
  })

  it("flashes on entering a drop and fades with a 0.35 second time constant", () => {
    const state = startedAt(0)
    state.advance(16, frameWith({ section: "drop" }))
    expect(state.dropFlash).toBe(1)

    run(state, 33, 350, frameWith({ section: "drop" }))
    expect(state.dropFlash).toBeGreaterThan(0.3)
    expect(state.dropFlash).toBeLessThan(0.45)
  })

  it("does not flash again while the drop continues", () => {
    const state = startedAt(0)
    run(state, 16, 3000, frameWith({ section: "drop" }))
    expect(state.dropFlash).toBeLessThan(0.01)
  })

  it.each([
    ["an idle groove", frameWith({ sub: 0 }), 0.35],
    ["a loud groove", frameWith({ sub: 1 }), 2.15],
    ["a drop", frameWith({ sub: 1, section: "drop" }), 2.95],
  ])("travels at the speed of %s", (_name, frame, unitsPerSecond) => {
    const state = startedAt(0)
    const before = state.travel
    run(state, 16, 1000, frame)
    expect(state.travel - before).toBeCloseTo(unitsPerSecond, 1)
  })
})

describe("easing toward a new look", () => {
  const target = PALETTES[1].colors

  it("moves smoothly instead of jumping", () => {
    const state = startedAt(0)
    const start = state.colors[0][0]
    state.setLook(lookWith({ colors: target, warp: 1 }), true, 0)

    state.advance(16, frameWith())
    const target0 = hexToRgb(target[0])[0]
    expect(state.colors[0][0]).not.toBeCloseTo(start, 3)
    expect(state.colors[0][0]).not.toBeCloseTo(target0, 3)
    expect(state.warp).toBeGreaterThan(DEFAULT_LOOK.warp)
    expect(state.warp).toBeLessThan(1)
  })

  it("settles on the new palette within about a second", () => {
    const state = startedAt(0)
    state.setLook(lookWith({ colors: target }), true, 0)
    run(state, 16, 1000, frameWith())
    target.forEach((hex, color) => {
      hexToRgb(hex).forEach((channel, index) => {
        expect(state.colors[color][index]).toBeCloseTo(channel, 2)
      })
    })
  })

  it.each([30, 60, 144])("takes the same time at %i frames per second", (fps) => {
    const state = startedAt(0)
    state.setLook(lookWith({ colors: target, mediaMix: 1 }), true, 0)
    run(state, 1000 / fps, 300, frameWith(), 1000 / fps)
    const reference = startedAt(0)
    reference.setLook(lookWith({ colors: target, mediaMix: 1 }), true, 0)
    run(reference, 1000 / 60, 300, frameWith(), 1000 / 60)

    expect(state.mediaMix).toBeCloseTo(reference.mediaMix, 1)
    expect(state.colors[0][0]).toBeCloseTo(reference.colors[0][0], 1)
  })
})
