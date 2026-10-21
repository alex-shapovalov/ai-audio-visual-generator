import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { CueRecord, MediaItem } from "@/lib/types"

interface DeckDB extends DBSchema {
  media: { key: string; value: MediaItem }
  cues: { key: string; value: CueRecord }
}

let connection: Promise<IDBPDatabase<DeckDB>> | null = null

const database = () => {
  connection ??= openDB<DeckDB>("ai-audio-visual-generator", 1, {
    upgrade(db) {
      db.createObjectStore("media", { keyPath: "id" })
      db.createObjectStore("cues", { keyPath: "id" })
    },
  })
  return connection
}

export const newId = () => crypto.randomUUID()

export const listMedia = async () => {
  const items = await (await database()).getAll("media")
  return items.sort((a, b) => b.createdAt - a.createdAt)
}

export const saveMedia = async (item: MediaItem) => {
  await (await database()).put("media", item)
}

export const deleteMedia = async (id: string) => {
  await (await database()).delete("media", id)
}

export const listCues = async () => {
  const cues = await (await database()).getAll("cues")
  return cues.sort((a, b) => b.createdAt - a.createdAt)
}

export const saveCue = async (cue: CueRecord) => {
  await (await database()).put("cues", cue)
}

export const deleteCue = async (id: string) => {
  await (await database()).delete("cues", id)
}
