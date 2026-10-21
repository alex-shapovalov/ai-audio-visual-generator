"use client"

import { useState } from "react"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type DescribeSectionProps = { deck: Deck }

export function DescribeSection({ deck }: DescribeSectionProps) {
  const [prompt, setPrompt] = useState("")
  const { response, busy, error, run } = deck.describe
  const canRun = prompt.trim() !== "" && !busy

  return (
    <Section title="Describe a look" hint="AI director with a local fallback">
      <Textarea
        aria-label="Describe a look"
        placeholder="filthy dubstep drop, acid green"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <Button type="button" onClick={() => run(prompt.trim())} disabled={!canRun}>
        {busy ? "Generating…" : "Generate look"}
      </Button>
      {response ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <Badge variant={response.source === "openrouter" ? "default" : "secondary"} data-testid="look-source">
            {response.source === "openrouter" ? "AI director" : "Local fallback"}
          </Badge>
          {response.reason ? <p className="text-xs">{response.reason}</p> : null}
          {response.note ? <Notice tone="info">{response.note}</Notice> : null}
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Section>
  )
}
