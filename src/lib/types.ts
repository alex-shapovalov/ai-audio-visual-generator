export const SCENES = [
  "portal",
  "grid",
  "strobe",
  "rift",
  "media",
  "bars",
  "aurora",
  "warp",
  "lasers",
  "bloom",
] as const
export type SceneId = (typeof SCENES)[number]

export type Section = "groove" | "breakdown" | "build" | "drop"

export type Colors = [string, string, string]

export type Look = {
  scene: SceneId
  colors: Colors
  mediaId: string | null
  mediaMix: number
  strobe: boolean
  warp: number
  kaleido: boolean
}

export type Frame = {
  sub: number
  low: number
  mid: number
  air: number
  kick: number
  bpm: number
  section: Section
}

export type MediaKind = "image" | "video"

export type MediaItem = {
  id: string
  name: string
  kind: MediaKind
  blob: Blob
  createdAt: number
}

export type TrackStats = {
  duration: number
  brightness: number
  bass: number
}

export type CueRecord = {
  id: string
  title: string
  createdAt: number
  stats: TrackStats
  hashes: Uint32Array
  times: Uint32Array
  look: Look
}

export type MatchStatus = {
  candidateId: string | null
  confirmed: boolean
  score: number
  runnerUp: number
  listenedSeconds: number
}

export type SourceKind = "device" | "file" | "simulator"

export const emptyFrame = (): Frame => ({
  sub: 0,
  low: 0,
  mid: 0,
  air: 0,
  kick: 0,
  bpm: 0,
  section: "groove",
})
