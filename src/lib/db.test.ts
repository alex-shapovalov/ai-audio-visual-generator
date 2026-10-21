import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_LOOK } from "@/lib/palettes"
import type { CueRecord, MediaItem } from "@/lib/types"

type Db = typeof import("@/lib/db")

let db: Db

beforeEach(async () => {
  vi.resetModules()
  globalThis.indexedDB = new IDBFactory()
  db = await import("@/lib/db")
})

const media = (overrides: Partial<MediaItem> = {}): MediaItem => ({
  id: crypto.randomUUID(),
  name: "loop.mp4",
  kind: "video",
  blob: new Blob(["video-bytes"], { type: "video/mp4" }),
  createdAt: 1,
  ...overrides,
})

const cue = (overrides: Partial<CueRecord> = {}): CueRecord => ({
  id: crypto.randomUUID(),
  title: "Warehouse 126",
  createdAt: 1,
  stats: { duration: 312, brightness: 0.04, bass: 0.55 },
  hashes: Uint32Array.of(10, 20, 30),
  times: Uint32Array.of(1, 2, 3),
  look: DEFAULT_LOOK,
  ...overrides,
})

describe("media store", () => {
  it("lists the newest item first", async () => {
    await db.saveMedia(media({ id: "old", createdAt: 1 }))
    await db.saveMedia(media({ id: "new", createdAt: 3 }))
    await db.saveMedia(media({ id: "middle", createdAt: 2 }))
    expect((await db.listMedia()).map((item) => item.id)).toEqual(["new", "middle", "old"])
  })

  it("keeps the blob contents and type", async () => {
    await db.saveMedia(media({ id: "clip", blob: new Blob(["abc"], { type: "image/png" }) }))
    const [stored] = await db.listMedia()
    expect(stored.blob.type).toBe("image/png")
    expect(await stored.blob.text()).toBe("abc")
  })

  it("replaces an item saved again under the same id", async () => {
    await db.saveMedia(media({ id: "clip", name: "before.mp4" }))
    await db.saveMedia(media({ id: "clip", name: "after.mp4" }))
    const items = await db.listMedia()
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe("after.mp4")
  })

  it("deletes an item", async () => {
    await db.saveMedia(media({ id: "keep" }))
    await db.saveMedia(media({ id: "drop" }))
    await db.deleteMedia("drop")
    expect((await db.listMedia()).map((item) => item.id)).toEqual(["keep"])
  })
})

describe("cue store", () => {
  it("lists the newest cue first", async () => {
    await db.saveCue(cue({ id: "old", createdAt: 1 }))
    await db.saveCue(cue({ id: "new", createdAt: 2 }))
    expect((await db.listCues()).map((item) => item.id)).toEqual(["new", "old"])
  })

  it("round-trips fingerprints as typed arrays together with the look", async () => {
    const look = { ...DEFAULT_LOOK, scene: "rift" as const, strobe: true }
    await db.saveCue(cue({ id: "track", look }))
    const [stored] = await db.listCues()
    expect(stored.hashes).toBeInstanceOf(Uint32Array)
    expect(Array.from(stored.hashes)).toEqual([10, 20, 30])
    expect(Array.from(stored.times)).toEqual([1, 2, 3])
    expect(stored.look).toEqual(look)
  })

  it("updates a cue's look when it is saved again", async () => {
    await db.saveCue(cue({ id: "track" }))
    await db.saveCue(cue({ id: "track", look: { ...DEFAULT_LOOK, scene: "grid" } }))
    const stored = await db.listCues()
    expect(stored).toHaveLength(1)
    expect(stored[0].look.scene).toBe("grid")
  })

  it("deletes a cue without touching media", async () => {
    await db.saveMedia(media({ id: "clip" }))
    await db.saveCue(cue({ id: "track" }))
    await db.deleteCue("track")
    expect(await db.listCues()).toHaveLength(0)
    expect(await db.listMedia()).toHaveLength(1)
  })
})

describe("newId", () => {
  it("returns distinct ids", () => {
    expect(db.newId()).not.toBe(db.newId())
  })
})
