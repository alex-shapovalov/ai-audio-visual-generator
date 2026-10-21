"use client"

import { useState, type RefObject } from "react"
import { useEnrollment } from "@/components/deck/use-enrollment"
import { useLibrary } from "@/components/deck/use-library"
import { useLookControl } from "@/components/deck/use-look-control"
import { useMatching } from "@/components/deck/use-matching"
import { useMediaBinding } from "@/components/deck/use-media-binding"
import { useMeters } from "@/components/deck/use-meters"
import { useOpenRouterKey } from "@/components/deck/use-open-router-key"
import { useRuntime } from "@/components/deck/use-runtime"
import { useSource } from "@/components/deck/use-source"
import { errorMessage } from "@/lib/error-message"
import { requestLookOrFallback } from "@/lib/look-client"
import type { LookRequest, LookResponse } from "@/lib/look-schema"
import type { CueRecord, Look } from "@/lib/types"

export type Deck = ReturnType<typeof useDeck>

export const useDeck = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const { runtime, error, matcherError } = useRuntime(canvasRef)
  const library = useLibrary()
  const control = useLookControl(runtime, library.media)
  const matching = useMatching({
    runtime,
    cues: library.cues,
    auto: control.auto,
    activeCueId: control.activeCueId,
    applyCue: control.applyCue,
  })
  const source = useSource(runtime, () => {
    matching.clearStatus()
    control.clearActiveCue()
  })
  const meters = useMeters(runtime)
  const apiKey = useOpenRouterKey()

  const activeMedia = library.media.find((item) => item.id === control.look.mediaId) ?? null
  const mediaBinding = useMediaBinding(runtime, activeMedia)

  const suggest = (request: LookRequest) => requestLookOrFallback(request, apiKey.key)
  const enrollment = useEnrollment({ runtime, library, suggest })

  const [described, setDescribed] = useState<LookResponse | null>(null)
  const [describing, setDescribing] = useState(false)
  const [describeError, setDescribeError] = useState<string | null>(null)

  const describeLook = async (prompt: string) => {
    setDescribing(true)
    setDescribeError(null)
    try {
      const media = library.media.map((item) => ({ id: item.id, name: item.name }))
      const response = await suggest({ prompt, media })
      setDescribed(response)
      control.showLook(response.look, false)
    } catch (cause) {
      setDescribeError(errorMessage(cause, "A look could not be generated"))
    } finally {
      setDescribing(false)
    }
  }

  const [suggestingFor, setSuggestingFor] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, LookResponse>>({})

  const suggestForCue = async (cue: CueRecord) => {
    setSuggestingFor(cue.id)
    try {
      const media = library.media.map((item) => ({ id: item.id, name: item.name }))
      const response = await suggest({ title: cue.title, stats: cue.stats, media })
      await library.updateCue(cue.id, (current) => ({ ...current, look: response.look }))
      setSuggestions((current) => ({ ...current, [cue.id]: response }))
    } finally {
      setSuggestingFor(null)
    }
  }

  const removeMedia = async (id: string) => {
    control.forgetMedia(id)
    await library.removeMedia(id)
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

  const toggleAuto = () => setAutoEnabled(!control.auto)

  const previewLook = (look: Look) => control.showLook(look, true)

  return {
    runtime,
    error,
    matcherError,
    library,
    control,
    matching,
    source,
    meters,
    apiKey,
    enrollment,
    activeMedia,
    mediaError: mediaBinding.error,
    describe: { response: described, busy: describing, error: describeError, run: describeLook },
    suggestForCue,
    suggestingFor,
    suggestions,
    removeMedia,
    resumeAuto,
    setAutoEnabled,
    toggleAuto,
    previewLook,
  }
}
