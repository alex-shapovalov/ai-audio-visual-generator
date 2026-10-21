"use client"

import { useEffect, useRef, useState } from "react"
import { StartupError } from "@/components/deck/startup-error"
import { useDisplay } from "@/components/deck/use-display"
import { enterFullscreen } from "@/lib/fullscreen"

export function DisplayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { error } = useDisplay(canvasRef)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") setStarted(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const start = () => {
    enterFullscreen()
    setStarted(true)
  }

  return (
    <main className="fixed inset-0 cursor-none bg-black">
      <canvas ref={canvasRef} aria-label="Visuals" className="block h-full w-full" />
      {error ? <StartupError message={error} /> : null}
      {started ? null : (
        <button
          type="button"
          aria-label="Start display"
          onClick={start}
          className="absolute inset-0 z-20 grid cursor-pointer place-items-center bg-black/70 p-6 text-center text-white"
        >
          <span className="flex max-w-md flex-col gap-2">
            <span className="text-xl font-semibold">Afterimage display</span>
            <span className="text-sm text-white/70">
              Click once to allow audio and go fullscreen. Everything else is controlled from the controls window.
            </span>
          </span>
        </button>
      )}
    </main>
  )
}
