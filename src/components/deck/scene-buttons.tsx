"use client"

import { Button } from "@/components/ui/button"
import { SCENES, type SceneId } from "@/lib/types"

const LABELS: Record<SceneId, string> = {
  portal: "Portal",
  grid: "Grid",
  strobe: "Strobe",
  rift: "Rift",
  media: "Media",
}

type SceneButtonsProps = {
  value: SceneId
  onChange: (scene: SceneId) => void
  showKeys?: boolean
}

export function SceneButtons({ value, onChange, showKeys = false }: SceneButtonsProps) {
  return (
    <div role="group" aria-label="Scene" className="grid grid-cols-5 gap-1.5">
      {SCENES.map((scene, index) => (
        <Button
          key={scene}
          type="button"
          size="sm"
          variant={scene === value ? "default" : "outline"}
          aria-pressed={scene === value}
          aria-keyshortcuts={String(index + 1)}
          onClick={() => onChange(scene)}
          className="flex-col gap-0 px-1 py-0.5 h-9"
        >
          <span>{LABELS[scene]}</span>
          {showKeys ? <span className="text-[0.6rem] opacity-60">{index + 1}</span> : null}
        </Button>
      ))}
    </div>
  )
}
