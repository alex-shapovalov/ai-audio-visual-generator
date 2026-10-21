"use client"

import { LabeledSlider, LabeledSwitch } from "@/components/deck/labeled-controls"
import { MediaSelect } from "@/components/deck/media-select"
import { Notice } from "@/components/deck/notice"
import { PaletteSwatches } from "@/components/deck/palette-swatches"
import { SceneButtons } from "@/components/deck/scene-buttons"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"

type LookSectionProps = { deck: Deck }

export function LookSection({ deck }: LookSectionProps) {
  const { control, library } = deck
  const { look } = control
  const needsMedia = look.scene === "media" && library.media.length === 0

  return (
    <Section title="Look" hint="Keys 1–9 and 0 pick a scene">
      <SceneButtons value={look.scene} onChange={control.selectScene} showKeys />
      {needsMedia ? <Notice tone="info">The media scene shows the portal until you add media in the Media tab.</Notice> : null}
      <PaletteSwatches colors={look.colors} onChange={(colors) => control.patchLook({ colors })} />
      <MediaSelect media={library.media} value={look.mediaId} onChange={control.chooseMedia} />
      <LabeledSlider label="Bass warp" value={look.warp} onChange={(warp) => control.patchLook({ warp })} />
      <LabeledSlider label="Media mix" value={look.mediaMix} onChange={(mediaMix) => control.patchLook({ mediaMix })} />
      <LabeledSwitch
        label="Kaleidoscope"
        description="Mirrors the media layer"
        checked={look.kaleido}
        onChange={(kaleido) => control.patchLook({ kaleido })}
      />
      <LabeledSwitch
        label="Strobe on this look"
        description="Only flashes while the strobe master is on"
        checked={look.strobe}
        onChange={(strobe) => control.patchLook({ strobe })}
      />
    </Section>
  )
}
