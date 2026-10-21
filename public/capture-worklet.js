class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunk = new Float32Array(2048)
    this.filled = 0
  }

  process(inputs) {
    const channels = inputs[0]
    if (!channels || channels.length === 0) return true
    const frames = channels[0].length
    for (let i = 0; i < frames; i++) {
      let sample = 0
      for (let c = 0; c < channels.length; c++) sample += channels[c][i]
      this.chunk[this.filled++] = sample / channels.length
      if (this.filled === this.chunk.length) {
        const copy = this.chunk.slice()
        this.port.postMessage(copy, [copy.buffer])
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor("capture-processor", CaptureProcessor)
