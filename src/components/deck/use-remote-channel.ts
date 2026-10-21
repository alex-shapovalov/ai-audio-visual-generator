"use client"

import { useEffect, useState } from "react"
import { RemoteChannel } from "@/remote/channel"

export const useRemoteChannel = () => {
  const [channel] = useState(() => new RemoteChannel())

  useEffect(() => {
    channel.open()
    return () => channel.close()
  }, [channel])

  return channel
}
