"use client"

import { useEffect, useState, type RefObject } from "react"
import { Engine } from "@/audio/engine"
import { MatcherClient } from "@/audio/matcher-client"
import { errorMessage } from "@/lib/error-message"
import { Renderer } from "@/visuals/renderer"

export type Runtime = {
  engine: Engine
  renderer: Renderer
  matcher: MatcherClient
}

export const useRuntime = (canvasRef: RefObject<HTMLCanvasElement | null>) => {
  const [runtime, setRuntime] = useState<Runtime | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matcherError, setMatcherError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let created: Runtime | null = null

    const start = async () => {
      try {
        const engine = await Engine.create()
        if (cancelled) {
          engine.dispose()
          return
        }
        try {
          const renderer = new Renderer(canvas, engine.frame, (now) => engine.tick(now))
          const matcher = new MatcherClient()
          matcher.onError = setMatcherError
          engine.onSamples = (chunk) => matcher.push(chunk)
          renderer.start()
          created = { engine, renderer, matcher }
          setRuntime(created)
        } catch (cause) {
          engine.dispose()
          throw cause
        }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause, "The visuals could not start"))
      }
    }
    void start()

    return () => {
      cancelled = true
      created?.renderer.dispose()
      created?.matcher.dispose()
      created?.engine.dispose()
    }
  }, [canvasRef])

  return { runtime, error, matcherError }
}
