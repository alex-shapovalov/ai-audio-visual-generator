"use client"

import { FilePicker } from "@/components/deck/file-picker"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SourceSectionProps = { deck: Deck }

export function SourceSection({ deck }: SourceSectionProps) {
  const { source, runtime } = deck
  const ready = runtime !== null && !source.busy
  const items = source.inputs.map((input) => ({ value: input.deviceId, label: input.label }))
  const playFirstFile = (files: File[]) => source.playFile(files[0])

  return (
    <Section title="Input" hint="Listen-only: inputs are never played back">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={source.connect} disabled={!ready}>
          Connect input
        </Button>
        <Button type="button" variant="outline" onClick={source.runDemo} disabled={!ready}>
          Run built-in demo
        </Button>
        <FilePicker accept="audio/*" label="Audio file to play as input" disabled={!ready} onFiles={playFirstFile}>
          Play a file as input (test)
        </FilePicker>
        <Button type="button" variant="ghost" onClick={source.stop} disabled={!ready || source.source === null}>
          Stop
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="flex gap-2">
          <Select items={items} value={source.deviceId} onValueChange={(value) => source.selectDevice(value ?? "")}>
            <SelectTrigger aria-label="Audio input" className="min-w-0 flex-1">
              <SelectValue placeholder="Choose an input" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={source.listen} disabled={!ready || source.deviceId === ""}>
            Listen
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {source.source ? (
          <>
            <Badge variant="secondary">{source.source.kind}</Badge>
            <span data-testid="source-label">{source.source.label}</span>
          </>
        ) : (
          <span>Not listening</span>
        )}
      </div>
      {source.source?.kind === "file" ? (
        <Notice tone="info">Test files play through your speakers. Live inputs never do.</Notice>
      ) : null}
      {source.error ? <Notice tone="error">{source.error}</Notice> : null}
    </Section>
  )
}
