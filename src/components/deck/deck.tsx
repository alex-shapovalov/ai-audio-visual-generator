"use client"

import { useRef, useState } from "react"
import { ControlPanel } from "@/components/deck/control-panel"
import { StartupError } from "@/components/deck/startup-error"
import { useDeck } from "@/components/deck/use-deck"
import { useRecentPointer } from "@/components/deck/use-recent-pointer"
import { useShortcuts } from "@/components/deck/use-shortcuts"
import { Button } from "@/components/ui/button"
import { toggleFullscreen } from "@/lib/fullscreen"
import { cn } from "@/lib/utils"

const CONTROLS_HINT_MS = 2500

export function Deck() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const deck = useDeck(canvasRef)
  const [panelOpen, setPanelOpen] = useState(true)
  const pointerRecent = useRecentPointer(CONTROLS_HINT_MS)

  useShortcuts({
    onScene: deck.control.selectScene,
    onToggleAuto: deck.toggleAuto,
    onTogglePanel: () => setPanelOpen((open) => !open),
    onFullscreen: toggleFullscreen,
  })

  return (
    <main className="relative min-h-svh">
      <canvas ref={canvasRef} aria-label="Visuals" className="fixed inset-0 h-full w-full" />
      {deck.error ? <StartupError message={deck.error} /> : null}
      {panelOpen ? (
        <ControlPanel deck={deck} onHide={() => setPanelOpen(false)} />
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setPanelOpen(true)}
          className={cn(
            "fixed right-4 bottom-4 z-20 opacity-0 transition-opacity focus-visible:opacity-100",
            pointerRecent && "opacity-100",
          )}
        >
          Show controls (H)
        </Button>
      )}
    </main>
  )
}
