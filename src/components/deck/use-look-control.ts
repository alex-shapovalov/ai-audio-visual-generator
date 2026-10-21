"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import type { Runtime } from "@/components/deck/use-runtime"
import { withMedia, withScene, withoutMedia } from "@/lib/look-edit"
import { sanitizeLook } from "@/lib/look-schema"
import { DEFAULT_LOOK } from "@/lib/palettes"
import type { CueRecord, Look, MediaItem, SceneId } from "@/lib/types"

export type LookControl = ReturnType<typeof useLookControl>

export const useLookControl = (runtime: Runtime | null, media: readonly MediaItem[]) => {
  const [look, setLook] = useState<Look>(DEFAULT_LOOK)
  const [auto, setAuto] = useState(true)
  const [strobeEnabled, setStrobeEnabled] = useState(false)
  const [activeCueId, setActiveCueId] = useState<string | null>(null)
  const latest = useRef<Look>(DEFAULT_LOOK)
  const mediaIds = media.map((item) => item.id)

  const pushInitialLook = useEffectEvent(() => runtime?.renderer.setLook(latest.current, true))
  useEffect(() => {
    pushInitialLook()
  }, [runtime])

  useEffect(() => {
    runtime?.renderer.setStrobeEnabled(strobeEnabled)
  }, [runtime, strobeEnabled])

  const commit = (next: Look, immediate: boolean) => {
    latest.current = next
    setLook(next)
    runtime?.renderer.setLook(next, immediate)
  }

  const editManually = (change: (current: Look) => Look) => {
    setAuto(false)
    commit(change(latest.current), false)
  }

  return {
    look,
    auto,
    strobeEnabled,
    activeCueId,
    setAuto,
    setStrobeEnabled,
    clearActiveCue: () => setActiveCueId(null),
    selectScene: (scene: SceneId) => editManually((current) => withScene(current, scene, mediaIds)),
    patchLook: (patch: Partial<Look>) => editManually((current) => ({ ...current, ...patch })),
    chooseMedia: (mediaId: string | null) => editManually((current) => withMedia(current, mediaId)),
    showLook: (next: Look, immediate: boolean) => {
      setAuto(false)
      commit(sanitizeLook(next, mediaIds, next), immediate)
    },
    applyCue: (cue: CueRecord) => {
      setActiveCueId(cue.id)
      commit(sanitizeLook(cue.look, mediaIds, cue.look), false)
    },
    forgetMedia: (removedId: string) => {
      const next = withoutMedia(latest.current, removedId)
      if (next !== latest.current) commit(next, true)
    },
  }
}
