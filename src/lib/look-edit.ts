import type { Look, SceneId } from "@/lib/types"

export const withScene = (look: Look, scene: SceneId, mediaIds: readonly string[]): Look => {
  if (scene !== "media") return { ...look, scene }
  return { ...look, scene, mediaId: look.mediaId ?? mediaIds[0] ?? null }
}

export const withMedia = (look: Look, mediaId: string | null): Look => {
  if (mediaId === null && look.scene === "media") return { ...look, mediaId, scene: "portal" }
  return { ...look, mediaId }
}

export const withoutMedia = (look: Look, removedId: string): Look => {
  if (look.mediaId !== removedId) return look
  return withMedia(look, null)
}
