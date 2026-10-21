"use client"

import { useEffect, useState } from "react"

export const useRecentPointer = (holdMs: number) => {
  const [recent, setRecent] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onMove = () => {
      setRecent(true)
      clearTimeout(timer)
      timer = setTimeout(() => setRecent(false), holdMs)
    }
    window.addEventListener("pointermove", onMove)
    return () => {
      window.removeEventListener("pointermove", onMove)
      clearTimeout(timer)
    }
  }, [holdMs])

  return recent
}
