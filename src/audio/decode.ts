import { Downsampler } from "@/audio/dsp"

export const MAX_TRACK_SECONDS = 3600

const DECODE_RATE = 44100
const CHUNK_SAMPLES = 1 << 20

type Pusher = { push(input: Float32Array): Float32Array }

export const mixToMono = (channels: readonly Float32Array[]): Float32Array => {
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i] / channels.length
    }
  }
  return mono
}

const concatenate = (parts: readonly Float32Array[]): Float32Array => {
  const joined = new Float32Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

export const downsampleInChunks = (
  downsampler: Pusher,
  input: Float32Array,
  chunkSize = CHUNK_SAMPLES,
): Float32Array => {
  const parts: Float32Array[] = []
  for (let start = 0; start < input.length; start += chunkSize) {
    parts.push(downsampler.push(input.subarray(start, start + chunkSize)))
  }
  return concatenate(parts)
}

export const decodeForMatching = async (file: Blob): Promise<Float32Array> => {
  const bytes = await file.arrayBuffer()
  const buffer = await new OfflineAudioContext(1, 1, DECODE_RATE).decodeAudioData(bytes)
  if (buffer.duration > MAX_TRACK_SECONDS) {
    throw new Error("Tracks longer than one hour cannot be enrolled")
  }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  )
  const downsampler = await Downsampler.create(buffer.sampleRate)
  try {
    return downsampleInChunks(downsampler, mixToMono(channels))
  } finally {
    downsampler.dispose()
  }
}
