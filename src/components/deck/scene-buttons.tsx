"use client"

import { Button } from "@/components/ui/button"
import { SCENE_KEYS } from "@/lib/shortcuts"
import { SCENES, type SceneId } from "@/lib/types"

const LABELS: Record<SceneId, string> = {
  portal: "Portal",
  grid: "Grid",
  strobe: "Strobe",
  rift: "Rift",
  media: "Media",
  bars: "Bars",
  aurora: "Aurora",
  warp: "Warp",
  lasers: "Lasers",
  bloom: "Bloom",
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
          aria-label={LABELS[scene]}
          aria-pressed={scene === value}
          aria-keyshortcuts={SCENE_KEYS[index]}
          onClick={() => onChange(scene)}
          className="flex-col gap-0 px-1 py-0.5 h-9"
        >
          <span>{LABELS[scene]}</span>
          {showKeys ? <span className="text-[0.6rem] opacity-60">{SCENE_KEYS[index]}</span> : null}
        </Button>
      ))}
    </div>
  )
}
