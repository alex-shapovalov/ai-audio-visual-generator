"use client"

import { useBusyAction } from "@/components/deck/use-busy-action"
import { useEngineSource } from "@/components/deck/use-engine-source"
import { useInputDevices } from "@/components/deck/use-input-devices"
import type { Runtime } from "@/components/deck/use-runtime"

export type { SourceState } from "@/components/deck/use-engine-source"

export const useSource = (runtime: Runtime | null, beforeChange: () => void) => {
  const action = useBusyAction()
  const devices = useInputDevices(action.run)
  const engine = useEngineSource(runtime, beforeChange, action)

  return {
    inputs: devices.inputs,
    deviceId: devices.deviceId,
    selectDevice: devices.selectDevice,
    connect: devices.connect,
    source: engine.source,
    error: action.error,
    busy: action.busy,
    listen: () => engine.listenTo(devices.deviceId, devices.labelOf(devices.deviceId)),
    playFile: engine.playFile,
    runDemo: engine.runDemo,
    stop: engine.stop,
  }
}
