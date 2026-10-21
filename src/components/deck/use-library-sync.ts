"use client"

import { useEffect, useEffectEvent } from "react"
import type { RemoteChannel } from "@/remote/channel"

export const useLibrarySync = (channel: RemoteChannel, reload: () => Promise<void>) => {
  const handleChange = useEffectEvent(() => {
    void reload()
  })

  useEffect(
    () =>
      channel.subscribe((message) => {
        if (message.kind === "library-changed") handleChange()
      }),
    [channel],
  )
}
