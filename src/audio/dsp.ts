import init, {
  Analyzer as WasmAnalyzer,
  Downsampler as WasmDownsampler,
  Matcher as WasmMatcher,
  fingerprint as wasmFingerprint,
} from "@/wasm/deck_dsp"
import type { Frame, MatchStatus, Section, TrackStats } from "@/lib/types"

export const WASM_URL = "/wasm/deck_dsp_bg.wasm"

export const SECTIONS: readonly Section[] = ["groove", "breakdown", "build", "drop"]

export type LibraryCue = { id: string; hashes: Uint32Array; times: Uint32Array }

export type Fingerprint = { hashes: Uint32Array; times: Uint32Array; stats: TrackStats }

let ready: Promise<void> | null = null

export const initDsp = (): Promise<void> => {
  ready ??= init({ module_or_path: WASM_URL }).then(
    () => undefined,
    (error: unknown) => {
      ready = null
      throw error
    },
  )
  return ready
}

export class Analyzer {
  private constructor(private readonly inner: WasmAnalyzer) {}

  static async create(sampleRate: number, binCount: number) {
    await initDsp()
    return new Analyzer(new WasmAnalyzer(sampleRate, binCount))
  }

  tick(spectrum: Float32Array, now: number, dt: number) {
    this.inner.tick(spectrum, now, dt)
  }

  tickIdle(now: number, dt: number) {
    this.inner.tick_idle(now, dt)
  }

  tickSimulated(now: number, dt: number) {
    this.inner.tick_simulated(now, dt)
  }

  resetSimulator(now: number) {
    this.inner.reset_simulator(now)
  }

  reset() {
    this.inner.reset()
  }

  readFrame(target: Frame) {
    const values = this.inner.frame()
    target.sub = values[0]
    target.low = values[1]
    target.mid = values[2]
    target.air = values[3]
    target.kick = values[4]
    target.bpm = values[5]
    target.section = SECTIONS[values[6]]
  }

  dispose() {
    this.inner.free()
  }
}

export class Downsampler {
  private constructor(private readonly inner: WasmDownsampler) {}

  static async create(inputRate: number) {
    await initDsp()
    return new Downsampler(new WasmDownsampler(inputRate))
  }

  push(input: Float32Array): Float32Array {
    return this.inner.push(input)
  }

  dispose() {
    this.inner.free()
  }
}

export class Matcher {
  private constructor(private readonly inner: WasmMatcher) {}

  static async create() {
    await initDsp()
    return new Matcher(new WasmMatcher())
  }

  setLibrary(cues: readonly LibraryCue[]) {
    this.inner.clear_library()
    for (const cue of cues) this.inner.add_cue(cue.id, cue.hashes, cue.times)
    this.inner.finish_library()
  }

  push(chunk: Float32Array): MatchStatus | null {
    const status = this.inner.push(chunk)
    if (!status) return null
    try {
      return {
        candidateId: status.candidate_id ?? null,
        confirmed: status.confirmed,
        score: status.score,
        runnerUp: status.runner_up,
        listenedSeconds: status.listened_seconds,
      }
    } finally {
      status.free()
    }
  }

  reset() {
    this.inner.reset()
  }

  dispose() {
    this.inner.free()
  }
}

export const fingerprint = async (samples: Float32Array): Promise<Fingerprint> => {
  await initDsp()
  const print = wasmFingerprint(samples)
  try {
    return {
      hashes: print.hashes,
      times: print.times,
      stats: { duration: print.duration, brightness: print.brightness, bass: print.bass },
    }
  } finally {
    print.free()
  }
}
