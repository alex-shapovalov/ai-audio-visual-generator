"use client"

import { Section } from "@/components/deck/section"
import { Badge } from "@/components/ui/badge"
import type { Frame } from "@/lib/types"

const BANDS = [
  { key: "sub", label: "Sub" },
  { key: "low", label: "Low" },
  { key: "mid", label: "Mid" },
  { key: "air", label: "Air" },
] as const

type MeterProps = { label: string; value: number }

function Meter({ label, value }: MeterProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-muted-foreground">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(2))}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  )
}

type MetersSectionProps = { meters: Frame }

export function MetersSection({ meters }: MetersSectionProps) {
  const tempo = meters.bpm > 0 ? `${Math.round(meters.bpm)} BPM` : "– BPM"
  return (
    <Section title="Signal">
      <div className="flex flex-col gap-1.5">
        {BANDS.map(({ key, label }) => (
          <Meter key={key} label={label} value={meters[key]} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-2">
          <span
            role="img"
            aria-label="Kick"
            className="size-3 rounded-full bg-primary"
            style={{ opacity: 0.15 + meters.kick * 0.85, transform: `scale(${0.8 + meters.kick * 0.5})` }}
          />
          <span aria-label="Tempo" className="tabular-nums">
            {tempo}
          </span>
        </span>
        <Badge variant="secondary" aria-label="Section" className="capitalize">
          {meters.section}
        </Badge>
      </div>
    </Section>
  )
}
