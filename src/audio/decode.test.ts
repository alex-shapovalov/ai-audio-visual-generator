import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Downsampler, WASM_URL, initDsp } from "@/audio/dsp"
import { MAX_TRACK_SECONDS, decodeForMatching, downsampleInChunks, mixToMono } from "@/audio/decode"

const WASM_PATH = fileURLToPath(new URL("../../public/wasm/deck_dsp_bg.wasm", import.meta.url))

const tone = (length: number, rate: number, hz: number) =>
  Float32Array.from({ length }, (_, index) => Math.sin((2 * Math.PI * hz * index) / rate))

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== WASM_URL) throw new Error(`unexpected fetch of ${String(input)}`)
      return new Response(readFileSync(WASM_PATH), { headers: { "content-type": "application/wasm" } })
    }),
  )
  await initDsp()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("mixToMono", () => {
  it("averages the channels", () => {
    const left = Float32Array.of(1, 1, 0.5)
    const right = Float32Array.of(0, 0.5, -0.5)
    expect(Array.from(mixToMono([left, right]))).toEqual([0.5, 0.75, 0])
  })

  it("passes a single channel through unchanged", () => {
    const channel = Float32Array.of(0.1, -0.2, 0.3)
    expect(mixToMono([channel])).toEqual(channel)
  })

  it("averages more than two channels", () => {
    const channels = [Float32Array.of(0.6), Float32Array.of(0.3), Float32Array.of(0)]
    expect(mixToMono(channels)[0]).toBeCloseTo(0.3, 6)
  })

  it("returns nothing for no channels", () => {
    expect(mixToMono([])).toHaveLength(0)
  })
})

describe("downsampleInChunks", () => {
  it.each([
    [44100, 1000],
    [44100, 4410],
    [48000, 777],
    [48000, 1 << 20],
  ])("matches a single call at %i Hz with %i-sample chunks", async (rate, chunkSize) => {
    const input = tone(rate * 2, rate, 440)
    const whole = await Downsampler.create(rate)
    const chunked = await Downsampler.create(rate)
    const expected = whole.push(input)
    const actual = downsampleInChunks(chunked, input, chunkSize)
    whole.dispose()
    chunked.dispose()
    expect(actual).toEqual(expected)
  })

  it("returns an empty array for empty input", async () => {
    const downsampler = await Downsampler.create(48000)
    expect(downsampleInChunks(downsampler, new Float32Array(0))).toHaveLength(0)
    downsampler.dispose()
  })
})

describe("decodeForMatching", () => {
  const decodedAs = (channels: Float32Array[], sampleRate: number) => {
    const buffer = {
      duration: channels[0].length / sampleRate,
      numberOfChannels: channels.length,
      sampleRate,
      getChannelData: (index: number) => channels[index],
    }
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = async () => buffer
      },
    )
  }

  const file = new Blob([new Uint8Array(8)])

  it("turns a decoded stereo file into 11025 Hz mono samples", async () => {
    const left = tone(44100 * 2, 44100, 300)
    decodedAs([left, left.slice()], 44100)

    const samples = await decodeForMatching(file)
    expect(Math.abs(samples.length - 2 * 11025)).toBeLessThanOrEqual(1)
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0)
    expect(peak).toBeGreaterThan(0.9)
  })

  it("rejects tracks longer than one hour", async () => {
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = async () => ({
          duration: MAX_TRACK_SECONDS + 1,
          numberOfChannels: 1,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(1000),
        })
      },
    )
    await expect(decodeForMatching(file)).rejects.toThrow("longer than one hour")
  })

  it("propagates a decoding failure", async () => {
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = async () => {
          throw new DOMException("Unable to decode audio data", "EncodingError")
        }
      },
    )
    await expect(decodeForMatching(file)).rejects.toThrow("Unable to decode")
  })
})
