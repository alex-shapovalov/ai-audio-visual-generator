"use client"

import { useState } from "react"
import { describeAudioError } from "@/audio/errors"

export const useBusyAction = () => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (work: () => Promise<void> | void) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (cause) {
      setError(describeAudioError(cause))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run, fail: setError }
}

export type BusyAction = ReturnType<typeof useBusyAction>
