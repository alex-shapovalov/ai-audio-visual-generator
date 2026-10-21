import { describe, expect, it } from "vitest"
import { DEFAULT_LOOK, PALETTES, hexToRgb, isHexColor } from "@/lib/palettes"

const luminance = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

describe("PALETTES", () => {
  it("has a distinct id and a distinct name for every palette", () => {
    expect(new Set(PALETTES.map((palette) => palette.id)).size).toBe(PALETTES.length)
    expect(new Set(PALETTES.map((palette) => palette.name)).size).toBe(PALETTES.length)
  })

  it("gives every palette three valid hex colors", () => {
    for (const palette of PALETTES) {
      expect(palette.colors, palette.name).toHaveLength(3)
      expect(palette.colors.every(isHexColor), palette.name).toBe(true)
    }
  })

  it("keeps the roles apart: bright accent, lighter secondary, dark background", () => {
    for (const { name, colors } of PALETTES) {
      const [accent, secondary, background] = colors.map(luminance)
      expect(background, name).toBeLessThan(0.15)
      expect(accent - background, name).toBeGreaterThan(0.3)
      expect(secondary - background, name).toBeGreaterThan(0.1)
    }
  })

  it("contains the palette the default look uses", () => {
    expect(PALETTES.some((palette) => palette.colors === DEFAULT_LOOK.colors)).toBe(true)
  })
})
