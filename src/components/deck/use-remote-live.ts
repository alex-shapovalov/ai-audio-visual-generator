"use client"

import { useEffect, useRef, useState } from "react"
import type { Live } from "@/components/deck/deck-types"
import { useBusyAction } from "@/components/deck/use-busy-action"
import { useInputDevices } from "@/components/deck/use-input-devices"
import { DEFAULT_LOOK } from "@/lib/palettes"
import { emptyFrame, type Look, type SceneId } from "@/lib/types"
import type { RemoteChannel } from "@/remote/channel"
import type { DisplaySnapshot } from "@/remote/protocol"

const STALE_AFTER_MS = 1500
const CHECK_EVERY_MS = 500
const IDLE_FRAME = emptyFrame()

export type RemoteLive = Live & { display: { connected: boolean; audioLocked: boolean } }

export const useRemoteLive = (channel: RemoteChannel): RemoteLive => {
  const [snapshot, setSnapshot] = useState<DisplaySnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const lastSeen = useRef(0)
  const action = useBusyAction()
  const devices = useInputDevices(action.run)

  useEffect(
    () =>
      channel.subscribe((message) => {
        if (message.kind !== "snapshot") return
        lastSeen.current = performance.now()
        setSnapshot(message.snapshot)
        setConnected(true)
      }),
    [channel],
  )

  useEffect(() => {
    const timer = setInterval(() => {
      if (performance.now() - lastSeen.current > STALE_AFTER_MS) setConnected(false)
    }, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  const send = channel.sendCommand
  const setAutoEnabled = (enabled: boolean) => send({ type: "auto", enabled })
  const auto = snapshot?.auto ?? true

  return {
    ready: connected,
    error: snapshot?.runtimeError ?? null,
    matcherError: snapshot?.matcherError ?? null,
    mediaError: snapshot?.mediaError ?? null,
    meters: connected && snapshot ? snapshot.frame : IDLE_FRAME,
    control: {
      look: snapshot?.look ?? DEFAULT_LOOK,
      auto,
      strobeEnabled: snapshot?.strobeEnabled ?? false,
      selectScene: (scene: SceneId) => send({ type: "scene", scene }),
      patchLook: (patch: Partial<Look>) => send({ type: "patch", patch }),
      chooseMedia: (mediaId: string | null) => send({ type: "media", mediaId }),
      setStrobeEnabled: (enabled: boolean) => send({ type: "strobe-master", enabled }),
      showLook: (look: Look, immediate: boolean) => send({ type: "show", look, immediate }),
    },
    matching: { status: snapshot?.match ?? null },
    source: {
      inputs: devices.inputs,
      deviceId: devices.deviceId,
      selectDevice: devices.selectDevice,
      connect: devices.connect,
      source: snapshot?.source ?? null,
      error: action.error ?? snapshot?.sourceError ?? null,
      busy: action.busy || snapshot?.sourceBusy === true,
      listen: () =>
        action.run(() => send({ type: "listen", deviceId: devices.deviceId, label: devices.labelOf(devices.deviceId) })),
      playFile: (file: File) => action.run(() => send({ type: "play-file", file })),
      runDemo: () => action.run(() => send({ type: "demo" })),
      stop: () => action.run(() => send({ type: "stop" })),
    },
    setAutoEnabled,
    resumeAuto: () => setAutoEnabled(true),
    toggleAuto: () => setAutoEnabled(!auto),
    forgetMedia: (id: string) => send({ type: "forget-media", id }),
    display: { connected, audioLocked: connected && snapshot?.audioLocked === true },
  }
}
