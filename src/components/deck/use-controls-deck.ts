"use client"

import type { Deck } from "@/components/deck/deck-types"
import { useDeckTools } from "@/components/deck/use-deck-tools"
import { useFingerprinter } from "@/components/deck/use-fingerprinter"
import { useLibrary } from "@/components/deck/use-library"
import { useLibrarySync } from "@/components/deck/use-library-sync"
import { useRemoteChannel } from "@/components/deck/use-remote-channel"
import { useRemoteLive, type RemoteLive } from "@/components/deck/use-remote-live"

export type ControlsDeck = Deck & Pick<RemoteLive, "display">

export const useControlsDeck = (): ControlsDeck => {
  const channel = useRemoteChannel()
  const library = useLibrary(channel.announceLibraryChange)
  useLibrarySync(channel, library.reload)
  const live = useRemoteLive(channel)
  const fingerprinter = useFingerprinter()
  const tools = useDeckTools({
    control: live.control,
    forgetMedia: live.forgetMedia,
    library,
    fingerprinter,
  })

  return { ...live, canEnroll: true, library, ...tools }
}
