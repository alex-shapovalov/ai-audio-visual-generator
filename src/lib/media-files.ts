import type { MediaKind } from "@/lib/types"

export const LARGE_IMAGE_BYTES = 20 * 1024 * 1024
export const LARGE_VIDEO_BYTES = 100 * 1024 * 1024
export const LARGE_FILE_WARNING =
  "Large file: it is stored whole in your browser, and videos are uploaded to the GPU every frame."

export const mediaKindOf = (file: { type: string }): MediaKind | null => {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  return null
}

export const isLargeMedia = (kind: MediaKind, bytes: number) => {
  const limit = kind === "image" ? LARGE_IMAGE_BYTES : LARGE_VIDEO_BYTES
  return bytes > limit
}
