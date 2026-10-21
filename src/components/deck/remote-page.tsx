"use client"

import { useEffect, useRef, useState } from "react"
import { LabeledSlider, LabeledSwitch } from "@/components/deck/labeled-controls"
import { MediaSelect } from "@/components/deck/media-select"
import { MetersSection } from "@/components/deck/meters-section"
import { Notice } from "@/components/deck/notice"
import { PaletteSwatches } from "@/components/deck/palette-swatches"
import { SceneButtons } from "@/components/deck/scene-buttons"
import { Section } from "@/components/deck/section"
import { Badge } from "@/components/ui/badge"
import { DEFAULT_LOOK } from "@/lib/palettes"
import { emptyFrame, type Look } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { Command, DisplaySnapshot } from "@/remote/protocol"

const STALE_AFTER_MS = 1500
const CHECK_EVERY_MS = 500
const IDLE_FRAME = emptyFrame()

const useRelaySession = () => {
  const [snapshot, setSnapshot] = useState<DisplaySnapshot | null>(null)
  const [linked, setLinked] = useState(false)
  const [fresh, setFresh] = useState(false)
  const [refused, setRefused] = useState(false)
  const lastSeen = useRef(0)

  useEffect(() => {
    const source = new EventSource("/events")
    source.onopen = () => setLinked(true)
    source.onerror = () => {
      setLinked(false)
      if (source.readyState === EventSource.CLOSED) setRefused(true)
    }
    source.addEventListener("snapshot", (event) => {
      lastSeen.current = performance.now()
      setSnapshot(JSON.parse((event as MessageEvent<string>).data) as DisplaySnapshot)
      setFresh(true)
    })
    return () => source.close()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (performance.now() - lastSeen.current > STALE_AFTER_MS) setFresh(false)
    }, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  const send = (command: Command) => {
    fetch("/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    })
      .then((response) => setRefused(response.status === 401))
      .catch(() => undefined)
  }

  return { snapshot, linked, connected: linked && fresh, refused, send }
}

const describeMatch = (snapshot: DisplaySnapshot) => {
  if (snapshot.source === null) return "No input is playing."
  if (snapshot.match === null) return "Listening…"
  const cue = snapshot.cues.find((entry) => entry.id === snapshot.match?.candidateId)
  const state = snapshot.match.confirmed ? "confirmed" : "searching"
  return `${cue?.title ?? "No match yet"} (${state})`
}

const STATUS = {
  connected: { variant: "default", label: "Display connected" },
  waiting: { variant: "secondary", label: "No display" },
  offline: { variant: "outline", label: "Not connected" },
} as const

const statusFor = (connected: boolean, linked: boolean) => {
  if (connected) return STATUS.connected
  return linked ? STATUS.waiting : STATUS.offline
}

export function RemotePage() {
  const { snapshot, linked, connected, refused, send } = useRelaySession()
  const look = snapshot?.look ?? DEFAULT_LOOK
  const patch = (change: Partial<Look>) => send({ type: "patch", patch: change })
  const status = statusFor(connected, linked)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-2 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Afterimage remote</h1>
          <p className="text-xs text-muted-foreground">Controls the display window on the laptop</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </header>

      {refused ? (
        <Notice tone="error">
          This device is not paired. Scan the QR code in the controls window again.
        </Notice>
      ) : null}
      {!refused && !connected ? (
        <Notice tone="warning">Waiting for the display window. Open it on the laptop and the controls will wake up.</Notice>
      ) : null}

      <div inert={!connected} className={cn("flex flex-col", !connected && "opacity-50")}>
        <MetersSection meters={snapshot?.frame ?? IDLE_FRAME} />
        <Section title="Look" hint="Tap a scene">
          <SceneButtons value={look.scene} onChange={(scene) => send({ type: "scene", scene })} />
          <PaletteSwatches colors={look.colors} onChange={(colors) => patch({ colors })} />
          <MediaSelect
            media={snapshot?.media ?? []}
            value={look.mediaId}
            onChange={(mediaId) => send({ type: "media", mediaId })}
          />
          <LabeledSlider label="Bass warp" value={look.warp} onChange={(warp) => patch({ warp })} />
          <LabeledSlider label="Media mix" value={look.mediaMix} onChange={(mediaMix) => patch({ mediaMix })} />
          <LabeledSwitch label="Kaleidoscope" checked={look.kaleido} onChange={(kaleido) => patch({ kaleido })} />
          <LabeledSwitch
            label="Strobe on this look"
            description="Only flashes while the strobe master is on"
            checked={look.strobe}
            onChange={(strobe) => patch({ strobe })}
          />
        </Section>
        <Section title="Track recognition">
          <LabeledSwitch
            label="Auto cues"
            description="Switch to a track's saved look when it is recognized"
            checked={snapshot?.auto ?? true}
            onChange={(enabled) => send({ type: "auto", enabled })}
          />
          <p role="status" className="text-xs text-muted-foreground">
            {snapshot ? describeMatch(snapshot) : "No input is playing."}
          </p>
        </Section>
        <Section title="Safety">
          <LabeledSwitch
            label="Strobe master"
            description="A remote can switch the strobe master off, never on. Switch it on from the laptop."
            checked={snapshot?.strobeEnabled ?? false}
            disabled={!snapshot?.strobeEnabled}
            onChange={() => send({ type: "strobe-master", enabled: false })}
          />
        </Section>
      </div>
    </main>
  )
}
