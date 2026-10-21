"use client"

import type { RefObject } from "react"
import type { Deck } from "@/components/deck/deck-types"
import { useDeckTools } from "@/components/deck/use-deck-tools"
import { useLibrary } from "@/components/deck/use-library"
import { useLiveEngine } from "@/components/deck/use-live-engine"
import { useMeters } from "@/components/deck/use-meters"
import { useSource } from "@/components/deck/use-source"

export type { Deck } from "@/components/deck/deck-types"

export const useDeck = (canvasRef: RefObject<HTMLCanvasElement | null>): Deck => {
  const library = useLibrary()
  const live = useLiveEngine(canvasRef, library)
  const source = useSource(live.runtime, live.beforeSourceChange)
  const meters = useMeters(live.runtime)
  const tools = useDeckTools({
    control: live.control,
    forgetMedia: live.forgetMedia,
    library,
    fingerprinter: live.runtime?.matcher ?? null,
  })

  return {
    ready: live.runtime !== null,
    canEnroll: live.runtime !== null,
    error: live.error,
    matcherError: live.matcherError,
    mediaError: live.mediaError,
    meters,
    control: live.control,
    matching: { status: live.matching.status },
    source,
    setAutoEnabled: live.setAutoEnabled,
    resumeAuto: live.resumeAuto,
    toggleAuto: live.toggleAuto,
    forgetMedia: live.forgetMedia,
    library,
    ...tools,
  }
}
