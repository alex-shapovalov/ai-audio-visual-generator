"use client"

import { LabeledSwitch } from "@/components/deck/labeled-controls"
import { MatchReadout } from "@/components/deck/match-readout"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"
import { Button } from "@/components/ui/button"

type CueSectionProps = { deck: Deck }

export function CueSection({ deck }: CueSectionProps) {
  const { control } = deck
  return (
    <Section title="Track recognition" hint="Press A to toggle auto cues">
      <LabeledSwitch
        label="Auto cues"
        description="Switch to a track's saved look when it is recognized"
        checked={control.auto}
        onChange={deck.setAutoEnabled}
      />
      {control.auto ? null : (
        <Notice tone="info" className="flex items-center justify-between gap-2">
          <span>Manual: cues paused</span>
          <Button type="button" size="xs" variant="outline" onClick={deck.resumeAuto}>
            Resume auto cues
          </Button>
        </Notice>
      )}
      {deck.matcherError ? (
        <Notice tone="error">Track recognition is unavailable: {deck.matcherError}</Notice>
      ) : null}
      <MatchReadout deck={deck} />
    </Section>
  )
}
