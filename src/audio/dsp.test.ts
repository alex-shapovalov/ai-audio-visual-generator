import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { Analyzer, Downsampler, Matcher, SECTIONS, WASM_URL, fingerprint, initDsp } from "@/audio/dsp"
import { emptyFrame, type MatchStatus } from "@/lib/types"
import { demo_track_names, render_demo_track } from "@/wasm/deck_dsp"

const WASM_PATH = fileURLToPath(new URL("../../public/wasm/deck_dsp_bg.wasm", import.meta.url))
const MATCH_RATE = 11025
const CAPTURE_RATE = 44100
const CHUNK = 2048
const TS_REFERENCE_HASH_COUNTS = [5433, 5760, 5340]

const serveWasm = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) !== WASM_URL) throw new Error(`unexpected fetch of ${String(input)}`)
    return new Response(readFileSync(WASM_PATH), { headers: { "content-type": "application/wasm" } })
  })

const lcg = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state / 4294967296) * 2 - 1
  }
}

const excerpt = (samples: Float32Array, startSeconds: number, seconds: number, noise: number, gain: number) => {
  const start = Math.floor(startSeconds * MATCH_RATE)
  const slice = samples.slice(start, start + Math.floor(seconds * MATCH_RATE))
  const next = lcg(1234)
  for (let i = 0; i < slice.length; i++) slice[i] = slice[i] * gain + next() * noise
  return slice
}

const noiseOnly = (seconds: number, amplitude: number) => {
  const next = lcg(99)
  return Float32Array.from({ length: seconds * MATCH_RATE }, () => next() * amplitude)
}

const pushInChunks = (matcher: Matcher, samples: Float32Array) => {
  const statuses: MatchStatus[] = []
  for (let i = 0; i + CHUNK <= samples.length; i += CHUNK) {
    const status = matcher.push(samples.subarray(i, i + CHUNK))
    if (status) statuses.push(status)
  }
  return statuses
}

const disposables: { dispose(): void }[] = []

const tracked = <T extends { dispose(): void }>(item: T) => {
  disposables.push(item)
  return item
}

const FRAME_MS = 1000 / 60
const KICK_GUARD_MS = 240
const ANALYZER_BINS = 1024
const SUB_BIN = 3

const kickTimes = async (pulseEveryFrames: number, seconds: number) => {
  const analyzer = tracked(await Analyzer.create(48000, ANALYZER_BINS))
  const silence = new Float32Array(ANALYZER_BINS).fill(-120)
  const pulse = silence.slice()
  pulse[SUB_BIN] = -10
  const frame = emptyFrame()
  const times: number[] = []
  for (let index = 0; index < seconds * 60; index++) {
    const now = index * FRAME_MS
    analyzer.tick(index % pulseEveryFrames === 0 ? pulse : silence, now, FRAME_MS / 1000)
    analyzer.readFrame(frame)
    if (frame.kick === 1) times.push(now)
  }
  return times
}

const gapsBetween = (times: number[]) => times.slice(1).map((time, index) => time - times[index])

type DemoTrack = { id: string; samples: Float32Array }

let tracks: DemoTrack[] = []

const libraryOf = async (cues: DemoTrack[]) => {
  const prints = await Promise.all(cues.map((cue) => fingerprint(cue.samples)))
  return cues.map((cue, index) => ({ id: cue.id, hashes: prints[index].hashes, times: prints[index].times }))
}

beforeAll(async () => {
  vi.stubGlobal("fetch", serveWasm())
  await initDsp()
  tracks = demo_track_names().map((id, index) => ({ id, samples: render_demo_track(index, MATCH_RATE) }))
})

afterEach(() => {
  disposables.splice(0).forEach((item) => item.dispose())
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("fingerprint through the wasm boundary", () => {
  it("matches the TypeScript reference hash counts for the demo tracks", async () => {
    for (const [index, track] of tracks.entries()) {
      const print = await fingerprint(track.samples)
      expect(print.hashes).toBeInstanceOf(Uint32Array)
      expect(print.times).toHaveLength(print.hashes.length)
      const reference = TS_REFERENCE_HASH_COUNTS[index]
      expect(Math.abs(print.hashes.length - reference)).toBeLessThanOrEqual(reference * 0.005)
      expect(print.stats.duration).toBeCloseTo(48, 3)
      expect(print.stats.bass).toBeGreaterThan(0.5)
    }
  })
})

describe("Matcher through the wasm boundary", () => {
  it("identifies every demo track from a noisy mid-track excerpt", async () => {
    const library = await libraryOf(tracks)
    for (const track of tracks) {
      const matcher = tracked(await Matcher.create())
      matcher.setLibrary(library)
      const statuses = pushInChunks(matcher, excerpt(track.samples, 17.3, 6, 0.05, 0.6))
      const last = statuses[statuses.length - 1]
      expect(last.candidateId).toBe(track.id)
      expect(last.score).toBeGreaterThanOrEqual(8)
      expect(last.score).toBeGreaterThan(last.runnerUp * 1.4)
    }
  })

  it("confirms only the playing track, and not on the first window", async () => {
    const matcher = tracked(await Matcher.create())
    matcher.setLibrary(await libraryOf(tracks))
    const statuses = pushInChunks(matcher, excerpt(tracks[1].samples, 5, 12, 0.02, 0.6))

    expect(statuses[0].confirmed).toBe(false)
    const confirmed = statuses.filter((status) => status.confirmed)
    expect(confirmed.length).toBeGreaterThan(0)
    expect(confirmed.every((status) => status.candidateId === tracks[1].id)).toBe(true)
  })

  it("matches live 44.1 kHz capture against a track enrolled from a decoded file", async () => {
    const trance = render_demo_track(2, CAPTURE_RATE)
    const enrollment = tracked(await Downsampler.create(CAPTURE_RATE))
    const enrolled = await fingerprint(enrollment.push(trance))
    const others = await libraryOf(tracks.filter((track) => track.id !== demo_track_names()[2]))

    const matcher = tracked(await Matcher.create())
    matcher.setLibrary([{ id: "enrolled", hashes: enrolled.hashes, times: enrolled.times }, ...others])

    const start = Math.floor(9.1 * CAPTURE_RATE)
    const halfLevel = trance.slice(start, start + 14 * CAPTURE_RATE).map((sample) => sample * 0.5)
    const capture = tracked(await Downsampler.create(CAPTURE_RATE))
    const parts: Float32Array[] = []
    for (let i = 0; i < halfLevel.length; i += CHUNK) {
      parts.push(capture.push(halfLevel.subarray(i, i + CHUNK)).slice())
    }
    const heard = new Float32Array(parts.reduce((total, part) => total + part.length, 0))
    let offset = 0
    for (const part of parts) {
      heard.set(part, offset)
      offset += part.length
    }

    const confirmed = pushInChunks(matcher, heard).filter((status) => status.confirmed)
    expect(confirmed.length).toBeGreaterThan(0)
    expect(confirmed.every((status) => status.candidateId === "enrolled")).toBe(true)
  })

  it("reports no candidate as null for noise", async () => {
    const matcher = tracked(await Matcher.create())
    matcher.setLibrary(await libraryOf(tracks))
    const statuses = pushInChunks(matcher, noiseOnly(10, 0.3))
    expect(statuses.length).toBeGreaterThan(3)
    for (const status of statuses) {
      expect(status.candidateId).toBeNull()
      expect(status.confirmed).toBe(false)
    }
  })

  it("forgets the previous source after reset", async () => {
    const matcher = tracked(await Matcher.create())
    matcher.setLibrary(await libraryOf(tracks))
    expect(pushInChunks(matcher, excerpt(tracks[0].samples, 8, 8, 0, 1)).some((s) => s.confirmed)).toBe(true)

    matcher.reset()
    expect(pushInChunks(matcher, excerpt(tracks[2].samples, 8, 2.8, 0, 1))).toHaveLength(0)
  })

  it("rejects a cue whose hash and time counts differ, with a readable message", async () => {
    const matcher = tracked(await Matcher.create())
    const broken = [{ id: "broken", hashes: new Uint32Array(3), times: new Uint32Array(2) }]
    expect(() => matcher.setLibrary(broken)).toThrow(/broken.*3 hashes.*2 times/)
  })
})

describe("Analyzer through the wasm boundary", () => {
  it("writes the simulator frame into the target and maps every section index", async () => {
    const analyzer = tracked(await Analyzer.create(48000, 1024))
    const frame = emptyFrame()
    const seen = new Set<string>()
    analyzer.resetSimulator(0)
    const frameMs = 1000 / 60
    for (let now = 0; now < 60_000; now += frameMs) {
      analyzer.tickSimulated(now, frameMs / 1000)
      analyzer.readFrame(frame)
      seen.add(frame.section)
    }

    expect([...seen].sort()).toEqual([...SECTIONS].sort())
    expect(frame.bpm).toBeGreaterThan(125)
    expect(frame.bpm).toBeLessThan(131)
    expect(frame.kick).toBeGreaterThanOrEqual(0)
    expect(frame.kick).toBeLessThanOrEqual(1)
  })

  it("reads band levels from a dB spectrum", async () => {
    const analyzer = tracked(await Analyzer.create(48000, 1024))
    const spectrum = new Float32Array(1024).fill(-120)
    spectrum[3] = -10
    analyzer.tick(spectrum, 0, 1 / 60)
    const frame = emptyFrame()
    analyzer.readFrame(frame)
    expect(frame.sub).toBeGreaterThan(0.9)
    expect(frame.air).toBeLessThan(0.01)
  })

  it("never reports two kicks closer than 240 ms, however fast the pulses arrive", async () => {
    const gaps = gapsBetween(await kickTimes(6, 10))
    expect(gaps.length).toBeGreaterThan(20)
    expect(Math.min(...gaps)).toBeGreaterThan(KICK_GUARD_MS)
  })

  it("reports every pulse of a groove slower than the guard", async () => {
    const times = await kickTimes(30, 10)
    expect(times).toHaveLength(19)
    for (const gap of gapsBetween(times)) expect(gap).toBeCloseTo(500, 1)
  })

  it("decays levels when idle", async () => {
    const analyzer = tracked(await Analyzer.create(48000, 1024))
    const spectrum = new Float32Array(1024).fill(-120)
    spectrum[3] = -10
    analyzer.tick(spectrum, 0, 1 / 60)
    for (let step = 1; step <= 60; step++) analyzer.tickIdle(step * (1000 / 60), 1 / 60)
    const frame = emptyFrame()
    analyzer.readFrame(frame)
    expect(frame.sub).toBeCloseTo(0.2, 1)
  })
})

describe("Downsampler through the wasm boundary", () => {
  it("returns 11025 Hz samples as a Float32Array", async () => {
    const downsampler = tracked(await Downsampler.create(48000))
    const output = downsampler.push(new Float32Array(48000 * 3).fill(0.25))
    expect(output).toBeInstanceOf(Float32Array)
    expect(Math.abs(output.length - 3 * MATCH_RATE)).toBeLessThanOrEqual(1)
    expect(output.every((sample) => Math.abs(sample - 0.25) < 1e-6)).toBe(true)
  })
})

describe("initDsp", () => {
  it("retries after a failed initialization instead of caching the failure", async () => {
    vi.resetModules()
    const fresh = await import("@/audio/dsp")
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(serveWasm())
    vi.stubGlobal("fetch", fetchMock)

    await expect(fresh.initDsp()).rejects.toThrow("offline")
    await expect(fresh.initDsp()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(WASM_URL)
    const downsampler = await fresh.Downsampler.create(48000)
    downsampler.dispose()
  })

  it("initializes once for concurrent callers", async () => {
    vi.resetModules()
    const fresh = await import("@/audio/dsp")
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(serveWasm())
    vi.stubGlobal("fetch", fetchMock)

    const [, , matcher] = await Promise.all([fresh.initDsp(), fresh.initDsp(), fresh.Matcher.create()])
    matcher.dispose()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
