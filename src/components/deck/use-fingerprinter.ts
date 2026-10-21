"use client"

import { useEffect, useRef } from "react"
import { MatcherClient } from "@/audio/matcher-client"
import type { Fingerprinter } from "@/components/deck/use-enrollment"

export const useFingerprinter = (): Fingerprinter => {
  const matcher = useRef<MatcherClient | null>(null)

  useEffect(
    () => () => {
      matcher.current?.dispose()
      matcher.current = null
    },
    [],
  )

  return {
    enroll: (samples) => {
      matcher.current ??= new MatcherClient()
      return matcher.current.enroll(samples)
    },
  }
}
