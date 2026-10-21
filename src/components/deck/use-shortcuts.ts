"use client"

import { useEffect, useEffectEvent } from "react"
import { isTypingTarget, sceneForKey } from "@/lib/shortcuts"
import type { SceneId } from "@/lib/types"

type Handlers = {
  onScene: (scene: SceneId) => void
  onToggleAuto: () => void
  onTogglePanel: () => void
  onFullscreen: () => void
}

export const useShortcuts = ({ onScene, onToggleAuto, onTogglePanel, onFullscreen }: Handlers) => {
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    if (isTypingTarget(event.target)) return

    const scene = sceneForKey(event.key)
    if (scene) return onScene(scene)

    switch (event.key.toLowerCase()) {
      case "a":
        return onToggleAuto()
      case "h":
        return onTogglePanel()
      case "f":
        return onFullscreen()
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])
}
