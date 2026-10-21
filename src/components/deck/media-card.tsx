"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { blobUrl } from "@/lib/blob-urls"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"

type MediaCardProps = {
  item: MediaItem
  selected: boolean
  onUse: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function Thumbnail({ item }: { item: MediaItem }) {
  const url = blobUrl(item.blob)
  if (item.kind === "video") {
    return <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
  }
  return <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} />
}

export function MediaCard({ item, selected, onUse, onRename, onDelete }: MediaCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.name)

  const startEditing = () => {
    setDraft(item.name)
    setEditing(true)
  }

  const finishEditing = (save: boolean) => {
    if (!editing) return
    setEditing(false)
    if (save) onRename(draft)
  }

  return (
    <li className={cn("flex flex-col gap-2 rounded-xl border p-2", selected && "border-primary ring-1 ring-primary")}>
      <button
        type="button"
        aria-label={`Use ${item.name} in the current look`}
        aria-pressed={selected}
        onClick={onUse}
        className="relative block aspect-video overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Thumbnail item={item} />
        <Badge variant="secondary" className="absolute bottom-1 left-1 capitalize">
          {item.kind}
        </Badge>
      </button>
      {editing ? (
        <Input
          ref={(node) => node?.focus()}
          aria-label={`New name for ${item.name}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finishEditing(true)
            if (event.key === "Escape") finishEditing(false)
          }}
        />
      ) : (
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs" title={item.name}>
            {item.name}
          </span>
          <span className="flex shrink-0 gap-0.5">
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Rename ${item.name}`} onClick={startEditing}>
              <Pencil />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Delete ${item.name}`} onClick={onDelete}>
              <Trash2 />
            </Button>
          </span>
        </div>
      )}
    </li>
  )
}
