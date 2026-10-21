"use client"

import { useEffect, useState } from "react"
import type { Runtime } from "@/components/deck/use-runtime"
import { emptyFrame, type Frame } from "@/lib/types"

const METER_INTERVAL_MS = 100

export const useMeters = (runtime: Runtime | null) => {
  const [meters, setMeters] = useState<Frame>(emptyFrame)

  useEffect(() => {
    if (!runtime) return
    const timer = setInterval(() => setMeters({ ...runtime.engine.frame }), METER_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [runtime])

  return meters
}
