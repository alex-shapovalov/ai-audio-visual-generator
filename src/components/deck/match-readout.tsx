"use client"

import type { Deck } from "@/components/deck/use-deck"
import { Badge } from "@/components/ui/badge"

const MATCH_THRESHOLD = 8
const SCORE_BAR_MAX = 32

type MatchReadoutProps = { deck: Deck }

function ScoreBar({ score }: { score: number }) {
  const filled = Math.min(1, score / SCORE_BAR_MAX) * 100
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label="Match score"
        aria-valuemin={0}
        aria-valuemax={SCORE_BAR_MAX}
        aria-valuenow={Math.min(score, SCORE_BAR_MAX)}
        className="relative h-2 rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${filled}%` }} />
        <div
          className="absolute -inset-y-0.5 w-px bg-foreground/70"
          style={{ left: `${(MATCH_THRESHOLD / SCORE_BAR_MAX) * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        Score {score} · a match needs {MATCH_THRESHOLD}
      </span>
    </div>
  )
}

export function MatchReadout({ deck }: MatchReadoutProps) {
  const { source, library, matching } = deck
  const { status } = matching

  if (source.source === null) {
    return <p className="text-xs text-muted-foreground">Start an input to listen for your tracks.</p>
  }
  if (library.cues.length === 0) {
    return <p className="text-xs text-muted-foreground">No tracks enrolled yet. Add some in the Tracks tab.</p>
  }
  if (status === null) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Listening…
      </p>
    )
  }

  const cue = library.cues.find((entry) => entry.id === status.candidateId)
  return (
    <div className="flex flex-col gap-2" role="status">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm" data-testid="match-title">
          {cue ? cue.title : "No match yet"}
        </span>
        {status.confirmed ? <Badge>Confirmed</Badge> : <Badge variant="secondary">Searching</Badge>}
      </div>
      <ScoreBar score={status.score} />
    </div>
  )
}
