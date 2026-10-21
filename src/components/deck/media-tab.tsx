"use client"

import { useState, type DragEvent } from "react"
import { FilePicker } from "@/components/deck/file-picker"
import { MediaCard } from "@/components/deck/media-card"
import { Notice } from "@/components/deck/notice"
import { Section } from "@/components/deck/section"
import type { Deck } from "@/components/deck/use-deck"
import type { UploadReport } from "@/components/deck/use-library"
import { Separator } from "@/components/ui/separator"
import { releaseBlobUrl } from "@/lib/blob-urls"
import { cn } from "@/lib/utils"

type MediaTabProps = { deck: Deck }

type DropZoneProps = { uploading: boolean; onFiles: (files: File[]) => void }

function DropZone({ uploading, onFiles }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      data-testid="media-dropzone"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center",
        dragging && "border-primary bg-primary/10",
      )}
    >
      <p className="text-sm">{uploading ? "Saving to this browser…" : "Drop images or video loops here"}</p>
      <FilePicker accept="image/*,video/*" label="Add media files" multiple disabled={uploading} onFiles={onFiles}>
        Choose files
      </FilePicker>
    </div>
  )
}

type ReportsProps = { reports: readonly UploadReport[] }

function Reports({ reports }: ReportsProps) {
  return (
    <>
      {reports.map((report) => {
        if (report.error) {
          return (
            <Notice key={report.name} tone="error">
              {report.name}: {report.error}
            </Notice>
          )
        }
        if (report.warning) {
          return (
            <Notice key={report.name} tone="warning">
              {report.name}: {report.warning}
            </Notice>
          )
        }
        return null
      })}
    </>
  )
}

function MediaGrid({ deck }: MediaTabProps) {
  const { library, control } = deck

  if (!library.loaded) return <Notice tone="info">Loading your media…</Notice>
  if (library.media.length === 0) {
    return <Notice tone="info">No media yet. Anything you add stays in this browser.</Notice>
  }

  return (
    <ul className="grid grid-cols-2 gap-2" aria-label="Media library">
      {library.media.map((item) => (
        <MediaCard
          key={item.id}
          item={item}
          selected={control.look.mediaId === item.id}
          onUse={() => control.chooseMedia(item.id)}
          onRename={(name) => library.renameMedia(item.id, name)}
          onDelete={async () => {
            await deck.removeMedia(item.id)
            releaseBlobUrl(item.blob)
          }}
        />
      ))}
    </ul>
  )
}

export function MediaTab({ deck }: MediaTabProps) {
  const { library } = deck
  const [reports, setReports] = useState<UploadReport[]>([])

  const addFiles = async (files: File[]) => setReports(await library.addMedia(files))

  return (
    <div className="flex flex-col">
      <Section title="Add media" hint="Images and video loops are stored in this browser">
        <DropZone uploading={library.uploading} onFiles={addFiles} />
        <Reports reports={reports} />
      </Section>
      <Separator />
      <Section title="Library" hint={`${library.media.length} item${library.media.length === 1 ? "" : "s"}`}>
        {library.error ? <Notice tone="error">{library.error}</Notice> : null}
        {deck.mediaError ? <Notice tone="error">{deck.mediaError}</Notice> : null}
        <MediaGrid deck={deck} />
      </Section>
    </div>
  )
}
