import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { WASM_URL, fingerprint, initDsp } from "@/audio/dsp"
import type { FromMatcher, ToMatcher } from "@/audio/matcher-protocol"
import type { MatchStatus } from "@/lib/types"
import { demo_track_names, render_demo_track } from "@/wasm/deck_dsp"

const WASM_PATH = fileURLToPath(new URL("../../public/wasm/deck_dsp_bg.wasm", import.meta.url))
const MATCH_RATE = 11025
const CHUNK = 470

const wasmResponse = () =>
  new Response(readFileSync(WASM_PATH), { headers: { "content-type": "application/wasm" } })

const serveWasm = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) !== WASM_URL) throw new Error(`unexpected fetch of ${String(input)}`)
    return wasmResponse()
  })

const loadFreshRuntime = async () => {
  vi.resetModules()
  const { MatcherClient } = await import("@/audio/matcher-client")
  const { MatcherSession } = await import("@/audio/matcher-protocol")

  class LoopbackWorker {
    onmessage: ((event: MessageEvent<FromMatcher>) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    private terminated = false
    private readonly session = new MatcherSession((message, transfer = []) => {
      if (this.terminated) return
      const delivered = structuredClone(message, { transfer })
      queueMicrotask(() => this.onmessage?.({ data: delivered } as MessageEvent<FromMatcher>))
    })

    postMessage(message: ToMatcher, transfer: Transferable[] = []) {
      if (this.terminated) return
      void this.session.handle(structuredClone(message, { transfer }))
    }

    terminate() {
      this.terminated = true
    }
  }

  vi.stubGlobal("Worker", LoopbackWorker)
  return { MatcherClient }
}

type DemoTrack = { id: string; samples: Float32Array }

let tracks: DemoTrack[] = []

const excerpt = (samples: Float32Array, startSeconds: number, seconds: number) => {
  const start = Math.floor(startSeconds * MATCH_RATE)
  return samples.slice(start, start + Math.floor(seconds * MATCH_RATE))
}

const libraryOf = async (cues: DemoTrack[]) =>
  Promise.all(
    cues.map(async (cue) => {
      const print = await fingerprint(cue.samples)
      return { id: cue.id, hashes: print.hashes, times: print.times }
    }),
  )

const pushInChunks = (client: { push(chunk: Float32Array): void }, samples: Float32Array) => {
  for (let i = 0; i + CHUNK <= samples.length; i += CHUNK) client.push(samples.subarray(i, i + CHUNK))
}

beforeAll(async () => {
  vi.stubGlobal("fetch", serveWasm())
  await initDsp()
  tracks = demo_track_names().map((id, index) => ({ id, samples: render_demo_track(index, MATCH_RATE) }))
})

afterEach(() => {
  vi.stubGlobal("fetch", serveWasm())
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("MatcherClient with the real session behind a structured-clone boundary", () => {
  it("enrolls samples into a fingerprint", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    const client = new MatcherClient()
    const print = await client.enroll(tracks[0].samples.slice())
    client.dispose()

    expect(print.hashes.length).toBeGreaterThan(5000)
    expect(print.times).toHaveLength(print.hashes.length)
    expect(print.stats.duration).toBeCloseTo(48, 3)
  })

  it("reports statuses for audio pushed after the library is set", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    const client = new MatcherClient()
    const statuses: MatchStatus[] = []
    client.onStatus = (status) => statuses.push(status)

    client.setLibrary(await libraryOf(tracks))
    pushInChunks(client, excerpt(tracks[1].samples, 5, 12))
    await vi.waitFor(() => expect(statuses.length).toBeGreaterThanOrEqual(6))
    client.dispose()

    expect(statuses[0].confirmed).toBe(false)
    const confirmed = statuses.filter((status) => status.confirmed)
    expect(confirmed.length).toBeGreaterThan(0)
    expect(confirmed.every((status) => status.candidateId === tracks[1].id)).toBe(true)
  })

  it("processes messages that arrive before the DSP module has loaded, in order", async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { MatcherClient } = await loadFreshRuntime()
    const library = await libraryOf(tracks)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate
        return wasmResponse()
      }),
    )

    const client = new MatcherClient()
    const statuses: MatchStatus[] = []
    client.onStatus = (status) => statuses.push(status)
    client.setLibrary(library)
    pushInChunks(client, excerpt(tracks[2].samples, 5, 8))
    client.reset()
    pushInChunks(client, excerpt(tracks[2].samples, 5, 8))
    release()

    await vi.waitFor(() => expect(statuses.length).toBeGreaterThanOrEqual(6))
    client.dispose()
    expect(statuses.every((status) => status.candidateId === null || status.candidateId === tracks[2].id)).toBe(true)
    expect(statuses.some((status) => status.confirmed)).toBe(true)
    expect(statuses.filter((status) => status.listenedSeconds < 3.5).length).toBe(2)
  })

  it("stops delivering statuses after unsubscribing, without disturbing a newer listener", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    const client = new MatcherClient()
    const first: MatchStatus[] = []
    const second: MatchStatus[] = []
    const unsubscribeFirst = client.subscribe((status) => first.push(status))
    client.subscribe((status) => second.push(status))
    unsubscribeFirst()

    client.setLibrary(await libraryOf(tracks))
    pushInChunks(client, excerpt(tracks[0].samples, 5, 5))
    await vi.waitFor(() => expect(second.length).toBeGreaterThanOrEqual(2))
    client.dispose()
    expect(first).toHaveLength(0)
  })

  it("reports a rejected library through onError", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    const client = new MatcherClient()
    const errors: string[] = []
    client.onError = (message) => errors.push(message)

    client.setLibrary([{ id: "broken", hashes: new Uint32Array(3), times: new Uint32Array(2) }])
    await vi.waitFor(() => expect(errors).toHaveLength(1))
    client.dispose()
    expect(errors[0]).toMatch(/broken.*3 hashes.*2 times/)
  })

  it("surfaces a DSP load failure through onError and rejects enrollment", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    const client = new MatcherClient()
    const errors: string[] = []
    client.onError = (message) => errors.push(message)

    await vi.waitFor(() => expect(errors).toEqual(["offline"]))
    await expect(client.enroll(new Float32Array(MATCH_RATE))).rejects.toThrow("offline")
    client.dispose()
  })

  it("rejects pending and future enrollments after dispose", async () => {
    const { MatcherClient } = await loadFreshRuntime()
    const client = new MatcherClient()
    const pending = client.enroll(tracks[0].samples.slice())
    client.dispose()

    await expect(pending).rejects.toThrow("Matcher stopped")
    await expect(client.enroll(new Float32Array(MATCH_RATE))).rejects.toThrow("Matcher stopped")
  })
})
