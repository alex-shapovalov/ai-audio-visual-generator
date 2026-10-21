"use client"

import { useEffect } from "react"
import type { RemoteChannel } from "@/remote/channel"
import { isMessage } from "@/remote/protocol"

export const useDisplayRelay = (channel: RemoteChannel) => {
  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let stopTap: (() => void) | null = null

    const connect = async () => {
      const config = (await (await fetch("/api/remote/config")).json()) as { relayPort: number | null }
      if (cancelled || config.relayPort === null) return
      const relay = `${window.location.protocol}//${window.location.hostname}:${config.relayPort}`

      source = new EventSource(`${relay}/events?role=display`)
      source.addEventListener("command", (event) => {
        const message = { kind: "command", command: JSON.parse((event as MessageEvent<string>).data) }
        if (isMessage(message)) channel.inject(message)
      })
      stopTap = channel.tapSnapshots((snapshot) => {
        fetch(`${relay}/snapshot`, { method: "POST", mode: "no-cors", body: JSON.stringify(snapshot) }).catch(
          () => undefined,
        )
      })
    }

    connect().catch(() => undefined)

    return () => {
      cancelled = true
      source?.close()
      stopTap?.()
    }
  }, [channel])
}
