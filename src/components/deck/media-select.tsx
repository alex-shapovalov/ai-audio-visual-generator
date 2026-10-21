"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MediaItem } from "@/lib/types"

const NONE = "none"

type MediaSelectProps = {
  media: readonly MediaItem[]
  value: string | null
  onChange: (mediaId: string | null) => void
}

export function MediaSelect({ media, value, onChange }: MediaSelectProps) {
  const items = [
    { value: NONE, label: "No media" },
    ...media.map((item) => ({ value: item.id, label: item.name })),
  ]
  return (
    <Select
      items={items}
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE || next === null ? null : next)}
    >
      <SelectTrigger size="sm" aria-label="Media layer" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
