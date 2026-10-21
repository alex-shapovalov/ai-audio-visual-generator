import type { Frame, Look, MatchStatus, SceneId, SourceKind } from "@/lib/types"

export const CHANNEL_NAME = "afterimage"

export type Command =
  | { type: "scene"; scene: SceneId }
  | { type: "patch"; patch: Partial<Look> }
  | { type: "media"; mediaId: string | null }
  | { type: "show"; look: Look; immediate: boolean }
  | { type: "forget-media"; id: string }
  | { type: "auto"; enabled: boolean }
  | { type: "strobe-master"; enabled: boolean }
  | { type: "listen"; deviceId: string; label: string }
  | { type: "play-file"; file: File }
  | { type: "demo" }
  | { type: "stop" }

export type SourceInfo = { kind: SourceKind; label: string }

export type DisplaySnapshot = {
  look: Look
  auto: boolean
  strobeEnabled: boolean
  frame: Frame
  match: MatchStatus | null
  source: SourceInfo | null
  sourceBusy: boolean
  sourceError: string | null
  audioLocked: boolean
  runtimeError: string | null
  matcherError: string | null
  mediaError: string | null
}

export type Message =
  | { kind: "command"; command: Command }
  | { kind: "snapshot"; snapshot: DisplaySnapshot }
  | { kind: "library-changed" }

const COMMAND_TYPES: ReadonlySet<string> = new Set<Command["type"]>([
  "scene",
  "patch",
  "media",
  "show",
  "forget-media",
  "auto",
  "strobe-master",
  "listen",
  "play-file",
  "demo",
  "stop",
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const isMessage = (value: unknown): value is Message => {
  if (!isRecord(value)) return false
  if (value.kind === "library-changed") return true
  if (value.kind === "snapshot") return isRecord(value.snapshot)
  if (value.kind === "command") {
    return isRecord(value.command) && typeof value.command.type === "string" && COMMAND_TYPES.has(value.command.type)
  }
  return false
}
