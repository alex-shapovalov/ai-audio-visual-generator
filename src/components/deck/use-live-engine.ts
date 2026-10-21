"use client"

import type { RefObject } from "react"
import type { Library } from "@/components/deck/use-library"
import { useLookControl } from "@/components/deck/use-look-control"
import { useMatching } from "@/components/deck/use-matching"
import { useMediaBinding } from "@/components/deck/use-media-binding"
import { useRuntime } from "@/components/deck/use-runtime"

export const useLiveEngine = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  library: Pick<Library, "media" | "cues">,
) => {
  const { runtime, error, matcherError } = useRuntime(canvasRef)
  const control = useLookControl(runtime, library.media)
  const matching = useMatching({
    runtime,
    cues: library.cues,
    auto: control.auto,
    activeCueId: control.activeCueId,
    applyCue: control.applyCue,
  })

  const activeMedia = library.media.find((item) => item.id === control.look.mediaId) ?? null
  const mediaBinding = useMediaBinding(runtime, activeMedia)

  const beforeSourceChange = () => {
    matching.clearStatus()
    control.clearActiveCue()
  }

  const resumeAuto = () => {
    control.setAuto(true)
    matching.reapplyConfirmed()
  }

  const setAutoEnabled = (enabled: boolean) => {
    if (enabled) {
      resumeAuto()
    } else {
      control.setAuto(false)
    }
  }

  return {
    runtime,
    error,
    matcherError,
    mediaError: mediaBinding.error,
    control,
    matching,
    beforeSourceChange,
    resumeAuto,
    setAutoEnabled,
    toggleAuto: () => setAutoEnabled(!control.auto),
    forgetMedia: control.forgetMedia,
  }
}
