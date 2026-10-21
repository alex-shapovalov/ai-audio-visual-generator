"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
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

export const useLibrary = (onChange?: () => void) => {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [cues, setCues] = useState<CueRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingUploads, setPendingUploads] = useState(0)
  const intendedMedia = useRef<MediaItem[]>([])
  const intendedCues = useRef<CueRecord[]>([])
  const writes = useRef<Promise<void>>(Promise.resolve())

  const publish = () => {
    setMedia(intendedMedia.current)
    setCues(intendedCues.current)
  }

  const readStored = async () => {
    const [storedMedia, storedCues] = await Promise.all([listMedia(), listCues()])
    intendedMedia.current = storedMedia
    intendedCues.current = storedCues
    publish()
  }

  const loadStored = useEffectEvent(() => readStored())

  useEffect(() => {
    let cancelled = false
    loadStored()
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, "Your saved media and tracks could not be loaded"))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const resync = async () => {
    try {
      await readStored()
    } catch (cause) {
      setError(errorMessage(cause, "Your saved media and tracks could not be reloaded"))
    }
  }

  const reload = async () => {
    await writes.current
    await resync()
  }

  const persist = (work: () => Promise<void>, failure: string) => {
    const task = writes.current.then(work).then(
      () => {
        publish()
        onChange?.()
      },
      async (cause: unknown) => {
        setError(errorMessage(cause, failure))
        await resync()
      },
    )
    writes.current = task
    return task
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
    intendedMedia.current = [item, ...intendedMedia.current]
    publish()
    onChange?.()
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

  const renameMedia = (id: string, name: string) => {
    const item = intendedMedia.current.find((entry) => entry.id === id)
    const trimmed = name.trim()
    if (!item || trimmed === "" || trimmed === item.name) return Promise.resolve()
    const renamed = { ...item, name: trimmed }
    intendedMedia.current = intendedMedia.current.map((entry) => (entry.id === id ? renamed : entry))
    return persist(() => saveMedia(renamed), "The media could not be renamed")
  }

  const removeMedia = (id: string) => {
    intendedMedia.current = intendedMedia.current.filter((entry) => entry.id !== id)
    return persist(() => deleteMedia(id), "The media could not be deleted")
  }

  const addCue = (cue: CueRecord) => {
    intendedCues.current = [cue, ...intendedCues.current]
    return persist(() => saveCue(cue), "The track could not be saved")
  }

  const updateCue = (id: string, change: (cue: CueRecord) => CueRecord) => {
    const current = intendedCues.current.find((entry) => entry.id === id)
    if (!current) return Promise.resolve()
    const next = change(current)
    intendedCues.current = intendedCues.current.map((entry) => (entry.id === id ? next : entry))
    return persist(() => saveCue(next), "The track could not be updated")
  }

  const removeCue = (id: string) => {
    intendedCues.current = intendedCues.current.filter((entry) => entry.id !== id)
    return persist(() => deleteCue(id), "The track could not be deleted")
  }

  return {
    media,
    cues,
    loaded,
    error,
    uploading: pendingUploads > 0,
    reload,
    clearError: () => setError(null),
    addMedia,
    renameMedia,
    removeMedia,
    addCue,
    updateCue,
    removeCue,
  }
}
