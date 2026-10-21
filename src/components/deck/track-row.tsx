"use client"

import { Trash2 } from "lucide-react"
import { LabeledSwitch } from "@/components/deck/labeled-controls"
import { MediaSelect } from "@/components/deck/media-select"
import { Notice } from "@/components/deck/notice"
import { PaletteSwatches } from "@/components/deck/palette-swatches"
import { SceneButtons } from "@/components/deck/scene-buttons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/format"
import { withMedia, withScene } from "@/lib/look-edit"
import type { LookResponse } from "@/lib/look-schema"
import type { CueRecord, Look, MatchStatus, MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"

type TrackRowProps = {
  cue: CueRecord
  media: readonly MediaItem[]
  match: MatchStatus | null
  suggestion: LookResponse | undefined
  suggesting: boolean
  onLookChange: (look: Look) => void
  onPreview: () => void
  onSuggest: () => void
  onDelete: () => void
}

export function TrackRow({
  cue,
  media,
  match,
  suggestion,
  suggesting,
  onLookChange,
  onPreview,
  onSuggest,
  onDelete,
}: TrackRowProps) {
  const mediaIds = media.map((item) => item.id)

  return (
    <li
      data-testid="track-row"
      aria-label={cue.title}
      className={cn("flex flex-col gap-3 rounded-xl border p-3", match && "border-primary ring-1 ring-primary")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium" title={cue.title}>
            {cue.title}
          </h4>
          <p className="text-xs text-muted-foreground">
            {formatDuration(cue.stats.duration)} · {cue.hashes.length} hashes
          </p>
        </div>
        {match ? <Badge data-testid="live-score">Score {match.score}</Badge> : null}
      </header>

      <SceneButtons value={cue.look.scene} onChange={(scene) => onLookChange(withScene(cue.look, scene, mediaIds))} />
      <PaletteSwatches colors={cue.look.colors} onChange={(colors) => onLookChange({ ...cue.look, colors })} />
      <MediaSelect media={media} value={cue.look.mediaId} onChange={(id) => onLookChange(withMedia(cue.look, id))} />
      <LabeledSwitch label="Strobe" checked={cue.look.strobe} onChange={(strobe) => onLookChange({ ...cue.look, strobe })} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSuggest} disabled={suggesting}>
          {suggesting ? "Asking…" : "Suggest with AI"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onDelete} aria-label={`Delete ${cue.title}`}>
          <Trash2 />
          Delete
        </Button>
      </div>

      {suggestion ? (
        <Notice tone="info" className="flex flex-col gap-1">
          <span>
            {suggestion.source === "openrouter" ? "AI director" : "Local fallback"}
            {suggestion.reason ? `: ${suggestion.reason}` : ""}
          </span>
          {suggestion.note ? <span>{suggestion.note}</span> : null}
        </Notice>
      ) : null}
    </li>
  )
}
