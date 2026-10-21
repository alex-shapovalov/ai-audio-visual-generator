"use client"

import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { DEFAULT_MODEL } from "@/lib/openrouter"

type SettingsTabProps = { deck: Deck }

export function SettingsTab({ deck }: SettingsTabProps) {
  const { key, setKey } = deck.apiKey

  return (
    <div className="flex flex-col">
      <Section title="OpenRouter">
        <label className="flex flex-col gap-1.5 text-sm">
          <span>API key</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-or-v1-…"
            value={key}
            onChange={(event) => setKey(event.target.value.trim())}
          />
        </label>
        <Notice tone="info">
          The key stays on this machine. It is kept in this browser&apos;s local storage and sent only to this
          app&apos;s own look service. Without a key here or in .env.local, looks come from a local keyword
          heuristic.
        </Notice>
        <Button type="button" variant="outline" className="self-start" onClick={() => setKey("")} disabled={key === ""}>
          Clear key
        </Button>
      </Section>
      <Separator />
      <Section title="Model">
        <Input readOnly aria-label="Model" value={DEFAULT_MODEL} />
        <p className="text-xs text-muted-foreground">
          The default model. Set OPENROUTER_MODEL on the server to use a different one.
        </p>
      </Section>
    </div>
  )
}
