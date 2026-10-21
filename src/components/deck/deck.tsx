"use client"

import { useRef, useState } from "react"
import { ControlPanel } from "@/components/deck/control-panel"
import { useDeck } from "@/components/deck/use-deck"
import { useRecentPointer } from "@/components/deck/use-recent-pointer"
import { useShortcuts } from "@/components/deck/use-shortcuts"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CONTROLS_HINT_MS = 2500

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
    return
  }
  document.documentElement.requestFullscreen().catch(() => undefined)
}

function StartupError({ message }: { message: string }) {
  return (
    <div role="alert" className="fixed inset-0 z-30 grid place-items-center bg-background/90 p-6 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold">The visuals could not start</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          Afterimage needs a browser with WebGL2 and WebAssembly. It has only been tested in Chromium.
        </p>
      </div>
    </div>
  )
}

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
