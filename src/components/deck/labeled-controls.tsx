"use client"

import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

type LabeledSliderProps = { label: string; value: number; onChange: (value: number) => void }

const firstValue = (value: number | readonly number[]) => (typeof value === "number" ? value : value[0])

export function LabeledSlider({ label, value, onChange }: LabeledSliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        aria-label={label}
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={(next) => onChange(firstValue(next))}
      />
    </div>
  )
}

type LabeledSwitchProps = {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function LabeledSwitch({ label, description, checked, onChange }: LabeledSwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
