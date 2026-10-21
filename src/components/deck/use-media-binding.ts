"use client"

import { useEffect, useState } from "react"
import type { Runtime } from "@/components/deck/use-runtime"
import { errorMessage } from "@/lib/error-message"
import type { MediaItem } from "@/lib/types"
import type { MediaSource } from "@/visuals/renderer"

const loadImage = async (url: string): Promise<MediaSource> => {
  const image = new Image()
  image.src = url
  await image.decode()
  return { element: image, width: image.naturalWidth, height: image.naturalHeight }
}

const loadVideo = (url: string) =>
  new Promise<MediaSource>((resolve, reject) => {
    const video = document.createElement("video")
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.onerror = () => reject(new Error("This video could not be played"))
    video.onloadedmetadata = () => {
      video
        .play()
        .then(() => resolve({ element: video, width: video.videoWidth, height: video.videoHeight }))
        .catch(reject)
    }
    video.src = url
  })

export const useMediaBinding = (runtime: Runtime | null, item: MediaItem | null) => {
  const [error, setError] = useState<string | null>(null)
  const blob = item?.blob ?? null
  const kind = item?.kind ?? null

  useEffect(() => {
    if (!runtime) return
    if (!blob || !kind) {
      runtime.renderer.setMedia(null)
      return
    }
    let cancelled = false
    let bound: MediaSource | null = null
    const url = URL.createObjectURL(blob)

    const load = async () => {
      try {
        const loaded = kind === "image" ? await loadImage(url) : await loadVideo(url)
        if (cancelled) {
          if (loaded.element instanceof HTMLVideoElement) loaded.element.pause()
          return
        }
        bound = loaded
        runtime.renderer.setMedia(loaded)
        setError(null)
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause, "This media could not be loaded"))
      }
    }
    void load()

    return () => {
      cancelled = true
      if (bound?.element instanceof HTMLVideoElement) bound.element.pause()
      URL.revokeObjectURL(url)
    }
  }, [runtime, blob, kind])

  return { error }
}
