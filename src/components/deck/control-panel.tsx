"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ControlTabs } from "@/components/deck/control-tabs"
import { Notice } from "@/components/deck/notice"
import type { Deck } from "@/components/deck/use-deck"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ControlPanelProps = { deck: Deck; onHide: () => void }

export function ControlPanel({ deck, onHide }: ControlPanelProps) {
  const router = useRouter()
  const [blocked, setBlocked] = useState(false)

  const splitScreens = () => {
    const display = window.open("/display", "afterimage-display", "popup,width=1280,height=720")
    setBlocked(display === null)
    if (display) router.push("/controls")
  }

  return (
    <aside
      aria-label="Controls"
      className={cn(
        "fixed z-20 flex flex-col border-border bg-background/85 text-foreground shadow-2xl backdrop-blur-xl",
        "inset-x-0 bottom-0 max-h-[68vh] rounded-t-2xl border-t",
        "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[26rem] md:rounded-none md:border-t-0 md:border-l",
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">Afterimage</h1>
          <p className="text-[0.7rem] text-muted-foreground">1–0 scenes · A auto · H hide · F fullscreen</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Open the display in its own window and keep the controls in this one"
            onClick={splitScreens}
          >
            Two screens
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onHide}>
            Hide
          </Button>
        </div>
      </header>
      {blocked ? (
        <Notice tone="error" className="mx-4 mb-2">
          Your browser blocked the popup. Allow popups for this site, or open /display in a new window yourself.
        </Notice>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <ControlTabs deck={deck} />
      </div>
    </aside>
  )
}
