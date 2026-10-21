"use client"

import { PALETTES } from "@/lib/palettes"
import type { Colors } from "@/lib/types"
import { cn } from "@/lib/utils"

const sameColors = (left: Colors, right: Colors) =>
  left.every((color, index) => color.toLowerCase() === right[index].toLowerCase())

type PaletteSwatchesProps = { colors: Colors; onChange: (colors: Colors) => void }

export function PaletteSwatches({ colors, onChange }: PaletteSwatchesProps) {
  return (
    <div role="group" aria-label="Palette" className="grid grid-cols-6 gap-2">
      {PALETTES.map((palette) => {
        const selected = sameColors(colors, palette.colors)
        const [bright, secondary, dark] = palette.colors
        return (
          <button
            key={palette.id}
            type="button"
            title={palette.name}
            aria-label={palette.name}
            aria-pressed={selected}
            onClick={() => onChange(palette.colors)}
            className={cn(
              "h-8 w-full rounded-md border border-border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "ring-2 ring-foreground",
            )}
            style={{
              background: `linear-gradient(135deg, ${bright} 0 38%, ${secondary} 38% 70%, ${dark} 70%)`,
            }}
          />
        )
      })}
    </div>
  )
}
