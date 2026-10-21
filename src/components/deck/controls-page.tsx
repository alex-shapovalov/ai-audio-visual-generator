"use client"

import { useState } from "react"
import { ControlTabs } from "@/components/deck/control-tabs"
import { Notice } from "@/components/deck/notice"
import { useControlsDeck } from "@/components/deck/use-controls-deck"
import { useShortcuts } from "@/components/deck/use-shortcuts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const DISPLAY_URL = "/display"
const DISPLAY_WINDOW = "afterimage-display"
const DISPLAY_FEATURES = "popup,width=1280,height=720"

const STATUS = {
  connected: { variant: "default", label: "Display connected" },
  waiting: { variant: "secondary", label: "No display" },
} as const

export function ControlsPage() {
  const deck = useControlsDeck()
  const [blocked, setBlocked] = useState(false)
  const { connected, audioLocked } = deck.display
  const status = STATUS[connected ? "connected" : "waiting"]

  useShortcuts({ onScene: deck.control.selectScene, onToggleAuto: deck.toggleAuto })

  const openDisplay = () => {
    setBlocked(window.open(DISPLAY_URL, DISPLAY_WINDOW, DISPLAY_FEATURES) === null)
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Afterimage controls</h1>
          <p className="text-xs text-muted-foreground">
            1–0 scenes · A auto cues · press F in the display window for fullscreen
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </header>

      {connected ? null : (
        <Notice tone="warning" className="flex items-center justify-between gap-3">
          <span>No display window is open. Open one, then move it to the screen you want to project on.</span>
          <Button type="button" size="sm" variant="outline" onClick={openDisplay}>
            Open display window
          </Button>
        </Notice>
      )}
      {connected || !blocked ? null : (
        <Notice tone="error">
          Your browser blocked the popup. Allow popups for this site, or open {DISPLAY_URL} in a new window yourself.
        </Notice>
      )}
      {audioLocked ? <Notice tone="info">Click the display window once so it is allowed to use audio.</Notice> : null}
      {deck.error ? <Notice tone="error">The display could not start: {deck.error}</Notice> : null}

      <ControlTabs deck={deck} liveEnabled={connected} />
    </main>
  )
}
