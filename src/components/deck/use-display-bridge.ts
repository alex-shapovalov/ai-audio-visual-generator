"use client"

import { useEffect, useEffectEvent } from "react"
import type { BusyAction } from "@/components/deck/use-busy-action"
import type { useEngineSource } from "@/components/deck/use-engine-source"
import type { useLiveEngine } from "@/components/deck/use-live-engine"
import { AUDIO_LOCKED_MESSAGE, hasUserActivation } from "@/lib/activation"
import { emptyFrame } from "@/lib/types"
import type { RemoteChannel } from "@/remote/channel"
import type { Command } from "@/remote/protocol"

const SNAPSHOT_INTERVAL_MS = 100

type Options = {
  channel: RemoteChannel
  live: ReturnType<typeof useLiveEngine>
  engineSource: ReturnType<typeof useEngineSource>
  action: BusyAction
}

export const useDisplayBridge = ({ channel, live, engineSource, action }: Options) => {
  const startAudio = (start: () => Promise<void>) => {
    if (hasUserActivation()) {
      void start()
    } else {
      action.fail(AUDIO_LOCKED_MESSAGE)
    }
  }

  const apply = useEffectEvent((command: Command) => {
    const { control } = live
    switch (command.type) {
      case "scene":
        control.selectScene(command.scene)
        break
      case "patch":
        control.patchLook(command.patch)
        break
      case "media":
        control.chooseMedia(command.mediaId)
        break
      case "show":
        control.showLook(command.look, command.immediate)
        break
      case "forget-media":
        live.forgetMedia(command.id)
        break
      case "auto":
        live.setAutoEnabled(command.enabled)
        break
      case "strobe-master":
        control.setStrobeEnabled(command.enabled)
        break
      case "listen":
        startAudio(() => engineSource.listenTo(command.deviceId, command.label))
        break
      case "play-file":
        startAudio(() => engineSource.playFile(command.file))
        break
      case "demo":
        void engineSource.runDemo()
        break
      case "stop":
        void engineSource.stop()
        break
    }
  })

  const publish = useEffectEvent(() => {
    channel.publish({
      look: live.control.look,
      auto: live.control.auto,
      strobeEnabled: live.control.strobeEnabled,
      frame: { ...(live.runtime?.engine.frame ?? emptyFrame()) },
      match: live.matching.status,
      source: engineSource.source,
      sourceBusy: action.busy,
      sourceError: action.error,
      audioLocked: !hasUserActivation(),
      runtimeError: live.error,
      matcherError: live.matcherError,
      mediaError: live.mediaError,
    })
  })

  useEffect(
    () =>
      channel.subscribe((message) => {
        if (message.kind === "command") apply(message.command)
      }),
    [channel],
  )

  useEffect(() => {
    const timer = setInterval(() => publish(), SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [channel])

  useEffect(() => {
    publish()
  }, [
    live.control.look,
    live.control.auto,
    live.control.strobeEnabled,
    live.matching.status,
    engineSource.source,
    action.busy,
    action.error,
    live.error,
    live.matcherError,
    live.mediaError,
  ])
}
