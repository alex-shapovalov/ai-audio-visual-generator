"use client"

import { useState } from "react"
import type { BusyAction } from "@/components/deck/use-busy-action"
import type { Runtime } from "@/components/deck/use-runtime"
import type { SourceInfo } from "@/remote/protocol"

export type SourceState = SourceInfo | null

export const useEngineSource = (runtime: Runtime | null, beforeChange: () => void, action: BusyAction) => {
  const [source, setSource] = useState<SourceState>(null)

  const run = (work: (active: Runtime) => Promise<void> | void) =>
    action.run(async () => {
      if (!runtime) return
      try {
        await work(runtime)
      } finally {
        const { engine } = runtime
        setSource(engine.source ? { kind: engine.source, label: engine.sourceLabel } : null)
      }
    })

  return {
    source,
    listenTo: (deviceId: string, label: string) =>
      run(async (active) => {
        beforeChange()
        await active.engine.useDevice(deviceId, label)
      }),
    playFile: (file: File) =>
      run(async (active) => {
        beforeChange()
        await active.engine.useFile(file)
      }),
    runDemo: () =>
      run((active) => {
        beforeChange()
        active.engine.useSimulator(performance.now())
      }),
    stop: () =>
      run((active) => {
        beforeChange()
        active.engine.stop()
      }),
  }
}
