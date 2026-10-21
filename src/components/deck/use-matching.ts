"use client"

import { useEffect, useEffectEvent, useState } from "react"
import type { Runtime } from "@/components/deck/use-runtime"
import type { CueRecord, MatchStatus } from "@/lib/types"

type Options = {
  runtime: Runtime | null
  cues: readonly CueRecord[]
  auto: boolean
  activeCueId: string | null
  applyCue: (cue: CueRecord) => void
}

export const useMatching = ({ runtime, cues, auto, activeCueId, applyCue }: Options) => {
  const [status, setStatus] = useState<MatchStatus | null>(null)
  const librarySignature = cues.map((cue) => cue.id).join("|")

  const publishLibrary = useEffectEvent(() => runtime?.matcher.setLibrary(cues))
  useEffect(() => {
    publishLibrary()
  }, [runtime, librarySignature])

  const handleStatus = useEffectEvent((next: MatchStatus) => {
    setStatus(next)
    const cue = cues.find((entry) => entry.id === next.candidateId)
    if (auto && next.confirmed && cue && cue.id !== activeCueId) applyCue(cue)
  })
  useEffect(() => runtime?.matcher.subscribe((next) => handleStatus(next)), [runtime])

  const confirmedCue = status?.confirmed ? cues.find((cue) => cue.id === status.candidateId) : undefined

  return {
    status,
    clearStatus: () => {
      setStatus(null)
      runtime?.matcher.reset()
    },
    reapplyConfirmed: () => {
      if (confirmedCue) applyCue(confirmedCue)
    },
  }
}
