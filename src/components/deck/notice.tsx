import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "error" | "warning" | "info"

const TONES: Record<Tone, string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  info: "border-border bg-muted/40 text-muted-foreground",
}

type NoticeProps = { tone: Tone; children: ReactNode; className?: string }

export function Notice({ tone, children, className }: NoticeProps) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-xs leading-relaxed", TONES[tone], className)}
    >
      {children}
    </p>
  )
}
