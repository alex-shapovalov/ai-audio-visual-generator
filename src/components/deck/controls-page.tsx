"use client"

import { useEffect, useState } from "react"
import { encode } from "uqr"
import { ControlTabs } from "@/components/deck/control-tabs"
import { Notice } from "@/components/deck/notice"
import { useControlsDeck } from "@/components/deck/use-controls-deck"
import { useShortcuts } from "@/components/deck/use-shortcuts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const STATUS = {
  connected: { variant: "default", label: "Display connected" },
  waiting: { variant: "secondary", label: "No display" },
} as const

const QUIET_ZONE = 2

type Pairing = { state: "checking" } | { state: "off" } | { state: "no-network" } | { state: "ready"; link: string }

const loadPairing = async (): Promise<Pairing> => {
  const config = (await (await fetch("/api/remote/config")).json()) as { relayPort: number | null }
  if (config.relayPort === null) return { state: "off" }
  const relay = `${window.location.protocol}//${window.location.hostname}:${config.relayPort}`
  const info = (await (await fetch(`${relay}/info`)).json()) as { urls: string[]; token: string }
  if (info.urls.length === 0) return { state: "no-network" }
  return { state: "ready", link: `${info.urls[0]}?token=${info.token}` }
}

function QrCode({ text }: { text: string }) {
  const { data } = encode(text)
  const side = data.length + QUIET_ZONE * 2
  return (
    <svg
      role="img"
      aria-label="QR code that pairs a phone"
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${side} ${side}`}
      shapeRendering="crispEdges"
      className="size-44 rounded-md bg-white"
    >
      {data.flatMap((row, y) =>
        row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
    </svg>
  )
}

function PairingDetails({ pairing }: { pairing: Pairing }) {
  if (pairing.state === "checking") return <p className="text-xs text-muted-foreground">Checking…</p>
  if (pairing.state === "off") {
    return (
      <p className="text-xs text-muted-foreground">
        Remote control is off. Run <code>pnpm build</code>, then <code>pnpm remote</code> instead of{" "}
        <code>pnpm dev</code>, to turn it on.
      </p>
    )
  }
  if (pairing.state === "no-network") {
    return (
      <p className="text-xs text-muted-foreground">
        No network address was found. Connect this computer to a network, then restart.
      </p>
    )
  }
  return (
    <>
      <QrCode text={pairing.link} />
      <code data-testid="remote-link" className="text-xs break-all">
        {pairing.link}
      </code>
      <p className="text-xs text-muted-foreground">
        Scan it with your phone&apos;s camera while it is on the same network as this computer. Anyone with this link
        can control the visuals, so keep it to yourself.
      </p>
    </>
  )
}

function PhoneRemote() {
  const [pairing, setPairing] = useState<Pairing>({ state: "checking" })

  useEffect(() => {
    let cancelled = false
    loadPairing()
      .then((next) => {
        if (!cancelled) setPairing(next)
      })
      .catch(() => {
        if (!cancelled) setPairing({ state: "off" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <details className="rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer">Control from a phone or tablet</summary>
      <div className="mt-3 flex flex-col gap-3">
        <PairingDetails pairing={pairing} />
      </div>
    </details>
  )
}

export function ControlsPage() {
  const deck = useControlsDeck()
  const [blocked, setBlocked] = useState(false)
  const { connected, audioLocked } = deck.display
  const status = STATUS[connected ? "connected" : "waiting"]

  useShortcuts({ onScene: deck.control.selectScene, onToggleAuto: deck.toggleAuto })

  const openDisplay = () => {
    const display = window.open("/display", "afterimage-display", "popup,width=1280,height=720")
    setBlocked(display === null)
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
          Your browser blocked the popup. Allow popups for this site, or open /display in a new window yourself.
        </Notice>
      )}
      {audioLocked ? <Notice tone="info">Click the display window once so it is allowed to use audio.</Notice> : null}
      {deck.error ? <Notice tone="error">The display could not start: {deck.error}</Notice> : null}

      <PhoneRemote />
      <ControlTabs deck={deck} liveEnabled={connected} />
    </main>
  )
}
