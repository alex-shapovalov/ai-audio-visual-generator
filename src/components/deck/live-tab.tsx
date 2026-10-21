"use client"

import { CueSection } from "@/components/deck/cue-section"
import { DescribeSection } from "@/components/deck/describe-section"
import { LookSection } from "@/components/deck/look-section"
import { MetersSection } from "@/components/deck/meters-section"
import { SafetySection } from "@/components/deck/safety-section"
import { SourceSection } from "@/components/deck/source-section"
import type { Deck } from "@/components/deck/use-deck"
import { Separator } from "@/components/ui/separator"

type LiveTabProps = { deck: Deck }

export function LiveTab({ deck }: LiveTabProps) {
  return (
    <div className="flex flex-col">
      <SourceSection deck={deck} />
      <Separator />
      <MetersSection meters={deck.meters} />
      <Separator />
      <LookSection deck={deck} />
      <Separator />
      <SafetySection deck={deck} />
      <Separator />
      <CueSection deck={deck} />
      <Separator />
      <DescribeSection deck={deck} />
    </div>
  )
}
