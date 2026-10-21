"use client"

import { ControlTabs } from "@/components/deck/control-tabs"
import type { Deck } from "@/components/deck/use-deck"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ControlPanelProps = { deck: Deck; onHide: () => void }

export function ControlPanel({ deck, onHide }: ControlPanelProps) {
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
        <Button type="button" size="sm" variant="ghost" onClick={onHide}>
          Hide
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <ControlTabs deck={deck} />
      </div>
    </aside>
  )
}
