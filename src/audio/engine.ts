import { Analyzer, Downsampler } from "@/audio/dsp"
import { emptyFrame, type Frame, type SourceKind } from "@/lib/types"

const FFT_SIZE = 2048
const DEFAULT_SAMPLE_RATE = 48000
const MIN_FRAME_SECONDS = 0.001
const MAX_FRAME_SECONDS = 0.1
const WORKLET_URL = "/capture-worklet.js"

const RAW_AUDIO = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const

export type AudioInput = { deviceId: string; label: string }

export const requestInputs = async (): Promise<AudioInput[]> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Audio capture needs a secure page", "SecurityError")
  }
  const probe = await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO })
  probe.getTracks().forEach((track) => track.stop())
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Input ${index + 1}`,
    }))
}

type Graph = {
  context: AudioContext
  analyser: AnalyserNode
  capture: AudioWorkletNode
  downsampler: Downsampler
}

const clampFrameSeconds = (seconds: number) =>
  Math.min(MAX_FRAME_SECONDS, Math.max(MIN_FRAME_SECONDS, seconds))

export class Engine {
  readonly frame: Frame = emptyFrame()
  source: SourceKind | null = null
  sourceLabel = ""
  onSamples: ((chunk: Float32Array) => void) | null = null

  private analyzer: Analyzer
  private graph: Promise<Graph> | null = null
  private resolvedGraph: Graph | null = null
  private readonly spectrum = new Float32Array(FFT_SIZE / 2)
  private stream: MediaStream | null = null
  private playing: AudioNode | null = null
  private lastTick = 0
  private generation = 0
  private disposed = false

  private constructor(analyzer: Analyzer) {
    this.analyzer = analyzer
  }

  static async create() {
    return new Engine(await Analyzer.create(DEFAULT_SAMPLE_RATE, FFT_SIZE / 2))
  }

  private ensureGraph(): Promise<Graph> {
    this.graph ??= this.buildGraph().catch((error: unknown) => {
      this.graph = null
      throw error
    })
    return this.graph
  }

  private async buildGraph(): Promise<Graph> {
    const context = new AudioContext({ latencyHint: "interactive" })
    await context.audioWorklet.addModule(WORKLET_URL)

    const analyser = context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0
    analyser.minDecibels = -120
    analyser.maxDecibels = -10

    const downsampler = await Downsampler.create(context.sampleRate)
    const capture = new AudioWorkletNode(context, "capture-processor")
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const chunk = downsampler.push(event.data)
      if (chunk.length > 0) this.onSamples?.(chunk)
    }

    const mute = context.createGain()
    mute.gain.value = 0
    capture.connect(mute).connect(context.destination)

    const analyzer = await Analyzer.create(context.sampleRate, analyser.frequencyBinCount)
    if (this.disposed) {
      void context.close()
      downsampler.dispose()
      analyzer.dispose()
      throw new Error("The audio engine was disposed")
    }
    this.analyzer.dispose()
    this.analyzer = analyzer

    await context.resume()
    const graph = { context, analyser, capture, downsampler }
    this.resolvedGraph = graph
    return graph
  }

  private begin() {
    this.stop()
    return this.generation
  }

  private attach(graph: Graph, node: AudioNode) {
    node.connect(graph.analyser)
    node.connect(graph.capture)
    this.playing = node
  }

  stop() {
    this.generation++
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.playing instanceof AudioBufferSourceNode) this.playing.stop()
    this.playing?.disconnect()
    this.playing = null
    this.source = null
    this.sourceLabel = ""
    this.analyzer.reset()
  }

  async useDevice(deviceId: string, label: string) {
    const generation = this.begin()
    const graph = await this.ensureGraph()
    await graph.context.resume()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, ...RAW_AUDIO },
    })
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    this.stream = stream
    this.attach(graph, graph.context.createMediaStreamSource(stream))
    this.source = "device"
    this.sourceLabel = label
  }

  async useFile(file: File) {
    const generation = this.begin()
    const graph = await this.ensureGraph()
    await graph.context.resume()
    const buffer = await graph.context.decodeAudioData(await file.arrayBuffer())
    if (generation !== this.generation) return
    const node = graph.context.createBufferSource()
    node.buffer = buffer
    node.loop = true
    node.connect(graph.context.destination)
    node.start()
    this.attach(graph, node)
    this.source = "file"
    this.sourceLabel = file.name
  }

  useSimulator(now: number) {
    this.stop()
    this.analyzer.resetSimulator(now)
    this.source = "simulator"
    this.sourceLabel = "Built-in 128 BPM loop"
  }

  tick(now: number) {
    if (this.disposed) return
    const dt = clampFrameSeconds((now - this.lastTick) / 1000)
    this.lastTick = now

    const graph = this.resolvedGraph
    if (this.source === "simulator") {
      this.analyzer.tickSimulated(now, dt)
    } else if (graph && this.playing) {
      graph.analyser.getFloatFrequencyData(this.spectrum)
      this.analyzer.tick(this.spectrum, now, dt)
    } else {
      this.analyzer.tickIdle(now, dt)
    }
    this.analyzer.readFrame(this.frame)
  }

  dispose() {
    if (this.disposed) return
    this.stop()
    this.disposed = true
    const graph = this.resolvedGraph
    this.resolvedGraph = null
    this.graph = null
    if (graph) {
      graph.capture.port.onmessage = null
      graph.capture.disconnect()
      void graph.context.close()
      graph.downsampler.dispose()
    }
    this.analyzer.dispose()
  }
}
