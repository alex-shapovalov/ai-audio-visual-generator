"use client"

import { EnrollQueue } from "@/components/deck/enroll-queue"
import { FilePicker } from "@/components/deck/file-picker"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import { TrackRow } from "@/components/deck/track-row"
import type { Deck } from "@/components/deck/use-deck"
import { Separator } from "@/components/ui/separator"

type TracksTabProps = { deck: Deck }

function TrackList({ deck }: TracksTabProps) {
  const { library, matching } = deck

  if (!library.loaded) return <Notice tone="info">Loading your tracks…</Notice>
  if (library.cues.length === 0) {
    return <Notice tone="info">No tracks enrolled yet. Choose audio files above to teach Afterimage your set.</Notice>
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Enrolled tracks">
      {library.cues.map((cue) => {
        const isMatch = matching.status?.candidateId === cue.id
        return (
          <TrackRow
            key={cue.id}
            cue={cue}
            media={library.media}
            match={isMatch ? matching.status : null}
            suggestion={deck.suggestions[cue.id]}
            suggesting={deck.suggestingFor === cue.id}
            onLookChange={(change) =>
              library.updateCue(cue.id, (current) => ({ ...current, look: change(current.look) }))
            }
            onPreview={() => deck.previewLook(cue.look)}
            onSuggest={() => deck.suggestForCue(cue)}
            onDelete={() => library.removeCue(cue.id)}
          />
        )
      })}
    </ul>
  )
}

export function TracksTab({ deck }: TracksTabProps) {
  const { library, enrollment } = deck
  const count = library.cues.length

  return (
    <div className="flex flex-col">
      <Section title="Enroll tracks" hint="Audio is fingerprinted here and never stored">
        <FilePicker
          accept="audio/*"
          label="Audio files to enroll"
          multiple
          disabled={!deck.canEnroll}
          onFiles={enrollment.enroll}
        >
          Choose tracks
        </FilePicker>
        <EnrollQueue jobs={enrollment.jobs} onClear={enrollment.clearFinished} />
      </Section>
      <Separator />
      <Section title="Library" hint={`${count} track${count === 1 ? "" : "s"}`}>
        {library.error ? <Notice tone="error">{library.error}</Notice> : null}
        <TrackList deck={deck} />
      </Section>
    </div>
  )
}
