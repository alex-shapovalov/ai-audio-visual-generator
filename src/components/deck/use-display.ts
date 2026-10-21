"use client"

import type { RefObject } from "react"
import { useBusyAction } from "@/components/deck/use-busy-action"
import { useDisplayBridge } from "@/components/deck/use-display-bridge"
import { useEngineSource } from "@/components/deck/use-engine-source"
import { useLibrary } from "@/components/deck/use-library"
import { useLibrarySync } from "@/components/deck/use-library-sync"
import { useLiveEngine } from "@/components/deck/use-live-engine"
import { useRemoteChannel } from "@/components/deck/use-remote-channel"
import { useShortcuts } from "@/components/deck/use-shortcuts"
import { toggleFullscreen } from "@/lib/fullscreen"

export const useDisplay = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const channel = useRemoteChannel()
  const library = useLibrary()
  useLibrarySync(channel, library.reload)
  const live = useLiveEngine(canvasRef, library)
  const action = useBusyAction()
  const engineSource = useEngineSource(live.runtime, live.beforeSourceChange, action)
  useDisplayBridge({ channel, live, engineSource, action })
  useShortcuts({
    onScene: live.control.selectScene,
    onToggleAuto: live.toggleAuto,
    onFullscreen: toggleFullscreen,
  })

  return { error: live.error }
}
