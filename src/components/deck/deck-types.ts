import type { AudioInput } from "@/audio/engine"
import type { Enrollment } from "@/components/deck/use-enrollment"
import type { SourceState } from "@/components/deck/use-engine-source"
import type { Library } from "@/components/deck/use-library"
import type { LookResponse } from "@/lib/look-schema"
import type { CueRecord, Frame, Look, MatchStatus, SceneId } from "@/lib/types"

export type LookControls = {
  look: Look
  auto: boolean
  strobeEnabled: boolean
  selectScene: (scene: SceneId) => void
  patchLook: (patch: Partial<Look>) => void
  chooseMedia: (mediaId: string | null) => void
  setStrobeEnabled: (enabled: boolean) => void
  showLook: (look: Look, immediate: boolean) => void
}

export type SourceControls = {
  inputs: AudioInput[]
  deviceId: string
  source: SourceState
  error: string | null
  busy: boolean
  selectDevice: (deviceId: string) => void
  connect: () => Promise<void>
  listen: () => Promise<void>
  playFile: (file: File) => Promise<void>
  runDemo: () => Promise<void>
  stop: () => Promise<void>
}

export type Live = {
  ready: boolean
  error: string | null
  matcherError: string | null
  mediaError: string | null
  meters: Frame
  control: LookControls
  matching: { status: MatchStatus | null }
  source: SourceControls
  setAutoEnabled: (enabled: boolean) => void
  resumeAuto: () => void
  toggleAuto: () => void
  forgetMedia: (id: string) => void
}

export type Deck = Live & {
  canEnroll: boolean
  library: Library
  enrollment: Enrollment
  describe: {
    response: LookResponse | null
    busy: boolean
    error: string | null
    run: (prompt: string) => Promise<void>
  }
  suggestForCue: (cue: CueRecord) => Promise<void>
  suggestingFor: string | null
  suggestions: Record<string, LookResponse>
  previewLook: (look: Look) => void
  removeMedia: (id: string) => Promise<void>
}
