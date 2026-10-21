import { Matcher, fingerprint, type Fingerprint, type LibraryCue } from "@/audio/dsp"
import type { MatchStatus } from "@/lib/types"

export type ToMatcher =
  | { type: "library"; cues: LibraryCue[] }
  | { type: "samples"; chunk: Float32Array }
  | { type: "reset" }
  | { type: "enroll"; requestId: number; samples: Float32Array }

export type FromMatcher =
  | { type: "status"; status: MatchStatus }
  | { type: "enrolled"; requestId: number; result: Fingerprint }
  | { type: "failed"; requestId: number; message: string }
  | { type: "error"; message: string }

export type Post = (message: FromMatcher, transfer?: Transferable[]) => void

const describe = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export class MatcherSession {
  private readonly matcher: Promise<Matcher | null>

  constructor(private readonly post: Post) {
    this.matcher = Matcher.create().catch((error: unknown) => {
      post({ type: "error", message: describe(error, "The DSP module failed to start") })
      return null
    })
  }

  async handle(message: ToMatcher): Promise<void> {
    if (message.type === "enroll") {
      await this.enroll(message.requestId, message.samples)
      return
    }
    const matcher = await this.matcher
    if (!matcher) return
    try {
      this.dispatch(matcher, message)
    } catch (error) {
      this.post({ type: "error", message: describe(error, "The matcher rejected a message") })
    }
  }

  private dispatch(matcher: Matcher, message: Exclude<ToMatcher, { type: "enroll" }>) {
    switch (message.type) {
      case "library":
        matcher.setLibrary(message.cues)
        return
      case "reset":
        matcher.reset()
        return
      case "samples": {
        const status = matcher.push(message.chunk)
        if (status) this.post({ type: "status", status })
        return
      }
    }
  }

  private async enroll(requestId: number, samples: Float32Array) {
    try {
      const result = await fingerprint(samples)
      const transfer = [result.hashes.buffer, result.times.buffer] as ArrayBuffer[]
      this.post({ type: "enrolled", requestId, result }, transfer)
    } catch (error) {
      this.post({ type: "failed", requestId, message: describe(error, "Fingerprinting failed") })
    }
  }
}
