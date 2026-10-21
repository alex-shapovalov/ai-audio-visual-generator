import type { Colors, Look } from "@/lib/types"

export type Palette = { id: string; name: string; colors: Colors }

export const PALETTES: Palette[] = [
  { id: "house", name: "Bone & Amber", colors: ["#f4ead5", "#ff9d2e", "#3a1d0b"] },
  { id: "dubstep", name: "Acid & Magenta", colors: ["#b6ff1a", "#ff1fa8", "#12001f"] },
  { id: "trance", name: "Cyan & Violet", colors: ["#2ee6ff", "#8a4dff", "#07052b"] },
  { id: "ember", name: "Ember", colors: ["#ff4d2e", "#ffd23f", "#1a0505"] },
  { id: "mono", name: "Monochrome", colors: ["#ffffff", "#8a8f98", "#050505"] },
  { id: "sunset", name: "Sunset", colors: ["#ff6b8b", "#ffb347", "#1b0a2a"] },
  { id: "ice", name: "Glacier", colors: ["#eafcff", "#4cc9f0", "#021826"] },
  { id: "toxic", name: "Toxic", colors: ["#8dff2e", "#00d1a0", "#02150b"] },
  { id: "royal", name: "Royal", colors: ["#ffd166", "#7a3cff", "#0b0420"] },
  { id: "crimson", name: "Crimson", colors: ["#ff3355", "#8c1245", "#16040b"] },
  { id: "synthwave", name: "Synthwave", colors: ["#00f0ff", "#ff2bd6", "#0a0220"] },
  { id: "abyss", name: "Deep Sea", colors: ["#5cf2d0", "#2f7bff", "#020a1e"] },
]

export const DEFAULT_LOOK: Look = {
  scene: "portal",
  colors: PALETTES[2].colors,
  mediaId: null,
  mediaMix: 0.5,
  strobe: false,
  warp: 0.4,
  kaleido: false,
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "")
  const full = value.length === 3 ? value.replace(/(.)/g, "$1$1") : value
  const n = Number.parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
