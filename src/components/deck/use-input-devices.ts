"use client"

import { useState } from "react"
import { requestInputs, type AudioInput } from "@/audio/engine"
import type { BusyAction } from "@/components/deck/use-busy-action"

const PREFERRED_INPUT = /evo\s*4|focusrite/i

const preferredDevice = (inputs: readonly AudioInput[]) =>
  inputs.find((input) => PREFERRED_INPUT.test(input.label))?.deviceId ?? inputs[0]?.deviceId ?? ""

export const useInputDevices = (run: BusyAction["run"]) => {
  const [inputs, setInputs] = useState<AudioInput[]>([])
  const [deviceId, setDeviceId] = useState("")

  const connect = () =>
    run(async () => {
      const found = await requestInputs()
      if (found.length === 0) throw new DOMException("No inputs", "NotFoundError")
      setInputs(found)
      setDeviceId((current) => (found.some((input) => input.deviceId === current) ? current : preferredDevice(found)))
    })

  const labelOf = (id: string) => inputs.find((entry) => entry.deviceId === id)?.label ?? "Audio input"

  return { inputs, deviceId, selectDevice: setDeviceId, connect, labelOf }
}
