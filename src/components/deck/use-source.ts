"use client"

import { useState } from "react"
import { describeAudioError } from "@/audio/errors"
import { requestInputs, type AudioInput } from "@/audio/engine"
import type { Runtime } from "@/components/deck/use-runtime"
import type { SourceKind } from "@/lib/types"

export type SourceState = { kind: SourceKind; label: string } | null

const PREFERRED_INPUT = /evo\s*4|focusrite/i

const preferredDevice = (inputs: readonly AudioInput[]) =>
  inputs.find((input) => PREFERRED_INPUT.test(input.label))?.deviceId ?? inputs[0]?.deviceId ?? ""

export const useSource = (runtime: Runtime | null, beforeChange: () => void) => {
  const [inputs, setInputs] = useState<AudioInput[]>([])
  const [deviceId, setDeviceId] = useState("")
  const [source, setSource] = useState<SourceState>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const readSource = (active: Runtime) => {
    const { engine } = active
    setSource(engine.source ? { kind: engine.source, label: engine.sourceLabel } : null)
  }

  const run = async (work: (active: Runtime) => Promise<void> | void) => {
    if (!runtime) return
    setBusy(true)
    setError(null)
    try {
      await work(runtime)
    } catch (cause) {
      setError(describeAudioError(cause))
    } finally {
      readSource(runtime)
      setBusy(false)
    }
  }

  return {
    inputs,
    deviceId,
    source,
    error,
    busy,
    selectDevice: setDeviceId,
    connect: () =>
      run(async () => {
        const found = await requestInputs()
        if (found.length === 0) throw new DOMException("No inputs", "NotFoundError")
        setInputs(found)
        setDeviceId((current) =>
          found.some((input) => input.deviceId === current) ? current : preferredDevice(found),
        )
      }),
    listen: () =>
      run(async (active) => {
        const input = inputs.find((entry) => entry.deviceId === deviceId)
        beforeChange()
        await active.engine.useDevice(deviceId, input?.label ?? "Audio input")
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
