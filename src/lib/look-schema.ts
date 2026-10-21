import { DEFAULT_LOOK, isHexColor } from "@/lib/palettes"
import { SCENES, type Colors, type Look, type SceneId, type TrackStats } from "@/lib/types"

export type MediaRef = { id: string; name: string }

export type LookRequest = {
  prompt?: string
  title?: string
  stats?: TrackStats
  media: MediaRef[]
}

export type LookResponse = {
  look: Look
  reason: string
  source: "openrouter" | "heuristic"
  note?: string
}

const clamp = (value: unknown, fallback: number) => {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
}

export const sanitizeLook = (raw: unknown, mediaIds: string[], fallback: Look = DEFAULT_LOOK): Look => {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>

  const scene = SCENES.includes(input.scene as SceneId) ? (input.scene as SceneId) : fallback.scene
  const colors =
    Array.isArray(input.colors) && input.colors.length >= 3 && input.colors.slice(0, 3).every(isHexColor)
      ? ([input.colors[0], input.colors[1], input.colors[2]] as Colors)
      : fallback.colors
  const mediaId =
    typeof input.mediaId === "string" && mediaIds.includes(input.mediaId) ? input.mediaId : null

  return {
    scene: scene === "media" && mediaId === null ? "portal" : scene,
    colors,
    mediaId,
    mediaMix: clamp(input.mediaMix, fallback.mediaMix),
    strobe: input.strobe === true,
    warp: clamp(input.warp, fallback.warp),
    kaleido: input.kaleido === true,
  }
}
