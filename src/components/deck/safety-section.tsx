"use client"

import { LabeledSwitch } from "@/components/deck/labeled-controls"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"

type SafetySectionProps = { deck: Deck }

export function SafetySection({ deck }: SafetySectionProps) {
  const { control } = deck
  return (
    <Section title="Safety">
      <LabeledSwitch
        label="Strobe master"
        description="Lets looks that have strobe turned on flash the whole screen. Off by default."
        checked={control.strobeEnabled}
        onChange={control.setStrobeEnabled}
      />
      <Notice tone="warning">
        Photosensitivity warning: flashing visuals can trigger seizures in people with photosensitive epilepsy.
        Flashes follow the kick and never fire more than about four times per second. Warn your audience before you
        turn strobe on.
      </Notice>
    </Section>
  )
}
