import type { Fingerprint, LibraryCue } from "@/audio/dsp"
import type { FromMatcher, ToMatcher } from "@/audio/matcher-protocol"
import type { MatchStatus } from "@/lib/types"

type Pending = {
  resolve: (result: Fingerprint) => void
  reject: (error: Error) => void
}

export class MatcherClient {
  onStatus: ((status: MatchStatus) => void) | null = null
  onError: ((message: string) => void) | null = null
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private disposed = false

  constructor() {
    this.worker = new Worker(new URL("./matcher.worker.ts", import.meta.url))
    this.worker.onmessage = (event: MessageEvent<FromMatcher>) => this.receive(event.data)
    this.worker.onerror = (event) => this.onError?.(event.message || "The matcher worker crashed")
  }

  subscribe(listener: (status: MatchStatus) => void) {
    this.onStatus = listener
    return () => {
      if (this.onStatus === listener) this.onStatus = null
    }
  }

  private receive(message: FromMatcher) {
    if (message.type === "status") {
      this.onStatus?.(message.status)
      return
    }
    if (message.type === "error") {
      this.onError?.(message.message)
      return
    }
    const entry = this.pending.get(message.requestId)
    if (!entry) return
    this.pending.delete(message.requestId)
    if (message.type === "enrolled") {
      entry.resolve(message.result)
    } else {
      entry.reject(new Error(message.message))
    }
  }

  private send(message: ToMatcher, transfer: Transferable[] = []) {
    this.worker.postMessage(message, transfer)
  }

  setLibrary(cues: readonly LibraryCue[]) {
    this.send({
      type: "library",
      cues: cues.map((cue) => ({ id: cue.id, hashes: cue.hashes, times: cue.times })),
    })
  }

  reset() {
    this.send({ type: "reset" })
  }

  push(chunk: Float32Array) {
    const copy = chunk.slice()
    this.send({ type: "samples", chunk: copy }, [copy.buffer])
  }

  enroll(samples: Float32Array): Promise<Fingerprint> {
    if (this.disposed) return Promise.reject(new Error("Matcher stopped"))
    const requestId = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.send({ type: "enroll", requestId, samples }, [samples.buffer])
    })
  }

  dispose() {
    this.disposed = true
    this.worker.terminate()
    this.pending.forEach((entry) => entry.reject(new Error("Matcher stopped")))
    this.pending.clear()
  }
}
