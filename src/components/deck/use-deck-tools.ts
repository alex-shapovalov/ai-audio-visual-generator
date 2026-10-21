"use client"

import { useState } from "react"
import type { Deck, LookControls } from "@/components/deck/deck-types"
import { useEnrollment, type Fingerprinter } from "@/components/deck/use-enrollment"
import type { Library } from "@/components/deck/use-library"
import { errorMessage } from "@/lib/error-message"
import { requestLookOrFallback } from "@/lib/look-client"
import type { LookRequest, LookResponse } from "@/lib/look-schema"
import type { CueRecord, Look } from "@/lib/types"

type Options = {
  control: Pick<LookControls, "showLook">
  forgetMedia: (id: string) => void
  library: Library
  fingerprinter: Fingerprinter | null
}

type Tools = Pick<
  Deck,
  "enrollment" | "describe" | "suggestForCue" | "suggestingFor" | "suggestions" | "previewLook" | "removeMedia"
>

export const useDeckTools = ({ control, forgetMedia, library, fingerprinter }: Options): Tools => {
  const suggest = (request: LookRequest) => requestLookOrFallback(request)
  const enrollment = useEnrollment({ fingerprinter, library, suggest })

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
    forgetMedia(id)
    await library.removeMedia(id)
  }

  return {
    enrollment,
    describe: { response: described, busy: describing, error: describeError, run: describeLook },
    suggestForCue,
    suggestingFor,
    suggestions,
    previewLook: (look: Look) => control.showLook(look, true),
    removeMedia,
  }
}
