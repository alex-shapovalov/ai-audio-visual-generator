"use client"

import { useEffect, useState } from "react"
import {
  deleteCue,
  deleteMedia,
  listCues,
  listMedia,
  newId,
  saveCue,
  saveMedia,
} from "@/lib/db"
import { errorMessage } from "@/lib/error-message"
import { LARGE_FILE_WARNING, isLargeMedia, mediaKindOf } from "@/lib/media-files"
import type { CueRecord, MediaItem } from "@/lib/types"

export type UploadReport = { name: string; error?: string; warning?: string }

export type Library = ReturnType<typeof useLibrary>

export const useLibrary = () => {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [cues, setCues] = useState<CueRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingUploads, setPendingUploads] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMedia(), listCues()])
      .then(([storedMedia, storedCues]) => {
        if (cancelled) return
        setMedia(storedMedia)
        setCues(storedCues)
        setLoaded(true)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(errorMessage(cause, "Your saved media and tracks could not be loaded"))
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const guard = async (work: () => Promise<void>, failure: string) => {
    try {
      await work()
    } catch (cause) {
      setError(errorMessage(cause, failure))
    }
  }

  const storeMedia = async (file: File): Promise<UploadReport> => {
    const kind = mediaKindOf(file)
    if (!kind) return { name: file.name, error: "Only images and videos can be added" }
    const item: MediaItem = {
      id: newId(),
      name: file.name,
      kind,
      blob: file,
      createdAt: Date.now(),
    }
    try {
      await saveMedia(item)
    } catch (cause) {
      return { name: file.name, error: errorMessage(cause, "The file could not be saved") }
    }
    setMedia((current) => [item, ...current])
    return { name: file.name, warning: isLargeMedia(kind, file.size) ? LARGE_FILE_WARNING : undefined }
  }

  const addMedia = async (files: File[]) => {
    setPendingUploads((count) => count + files.length)
    const reports: UploadReport[] = []
    for (const file of files) {
      reports.push(await storeMedia(file))
      setPendingUploads((count) => count - 1)
    }
    return reports
  }

  const renameMedia = (id: string, name: string) =>
    guard(async () => {
      const item = media.find((entry) => entry.id === id)
      const trimmed = name.trim()
      if (!item || trimmed === "" || trimmed === item.name) return
      const renamed = { ...item, name: trimmed }
      await saveMedia(renamed)
      setMedia((current) => current.map((entry) => (entry.id === id ? renamed : entry)))
    }, "The media could not be renamed")

  const removeMedia = (id: string) =>
    guard(async () => {
      await deleteMedia(id)
      setMedia((current) => current.filter((entry) => entry.id !== id))
    }, "The media could not be deleted")

  const addCue = (cue: CueRecord) =>
    guard(async () => {
      await saveCue(cue)
      setCues((current) => [cue, ...current])
    }, "The track could not be saved")

  const updateCue = (cue: CueRecord) =>
    guard(async () => {
      await saveCue(cue)
      setCues((current) => current.map((entry) => (entry.id === cue.id ? cue : entry)))
    }, "The track could not be updated")

  const removeCue = (id: string) =>
    guard(async () => {
      await deleteCue(id)
      setCues((current) => current.filter((entry) => entry.id !== id))
    }, "The track could not be deleted")

  return {
    media,
    cues,
    loaded,
    error,
    uploading: pendingUploads > 0,
    clearError: () => setError(null),
    addMedia,
    renameMedia,
    removeMedia,
    addCue,
    updateCue,
    removeCue,
  }
}
