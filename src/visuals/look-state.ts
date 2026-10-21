import { DEFAULT_LOOK, hexToRgb } from "@/lib/palettes"
import type { Frame, Look, SceneId, Section } from "@/lib/types"

export type Vec3 = [number, number, number]
export type ColorSet = [Vec3, Vec3, Vec3]

type PendingScene = { look: Look; at: number }

const SCENE_SWITCH_TIMEOUT_MS = 700
const SMOOTHING_PER_SECOND = 7
const KICK_EDGE = 0.9
const MIN_FRAME_SECONDS = 0.001
const MAX_FRAME_SECONDS = 0.1
const BASE_SPEED = 0.35
const SUB_SPEED = 1.8
const DROP_SPEED = 0.8
const OPEN_RATE = 0.6
const DROP_FLASH_TAU = 0.35

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

const colorsOf = (look: Look): ColorSet => [
  hexToRgb(look.colors[0]),
  hexToRgb(look.colors[1]),
  hexToRgb(look.colors[2]),
]

const travelSpeed = (frame: Frame) =>
  BASE_SPEED + frame.sub * SUB_SPEED + (frame.section === "drop" ? DROP_SPEED : 0)

export class LookState {
  look: Look = DEFAULT_LOOK
  scene: SceneId = DEFAULT_LOOK.scene
  colors: ColorSet = colorsOf(DEFAULT_LOOK)
  warp: number = DEFAULT_LOOK.warp
  mediaMix: number = DEFAULT_LOOK.mediaMix
  travel = 0
  open = 0
  dropFlash = 0

  private target: ColorSet = colorsOf(DEFAULT_LOOK)
  private pending: PendingScene | null = null
  private previousSection: Section = "groove"
  private previousKick = 0
  private lastTime = 0

  setLook(look: Look, immediate: boolean, now: number) {
    if (immediate) {
      this.scene = look.scene
      this.adopt(look)
      this.pending = null
      return
    }
    this.adopt({ ...look, scene: this.scene })
    this.pending = look.scene === this.scene ? null : { look, at: now }
  }

  advance(now: number, frame: Frame) {
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(MIN_FRAME_SECONDS, (now - this.lastTime) / 1000))
    this.lastTime = now
    const amount = 1 - Math.exp(-dt * SMOOTHING_PER_SECOND)

    this.resolveScene(now, frame)
    this.travel += dt * travelSpeed(frame)
    this.open = lerp(this.open, frame.section === "breakdown" ? 1 : 0, amount * OPEN_RATE)
    this.updateDropFlash(frame, dt)
    this.easeTowardTarget(amount)
  }

  private adopt(look: Look) {
    this.look = look
    this.target = colorsOf(look)
  }

  private resolveScene(now: number, frame: Frame) {
    const kickEdge = frame.kick > KICK_EDGE && this.previousKick <= KICK_EDGE
    this.previousKick = frame.kick
    if (this.pending && (kickEdge || now - this.pending.at > SCENE_SWITCH_TIMEOUT_MS)) {
      this.scene = this.pending.look.scene
      this.adopt(this.pending.look)
      this.pending = null
    }
  }

  private updateDropFlash(frame: Frame, dt: number) {
    this.dropFlash *= Math.exp(-dt / DROP_FLASH_TAU)
    if (frame.section === "drop" && this.previousSection !== "drop") this.dropFlash = 1
    this.previousSection = frame.section
  }

  private easeTowardTarget(amount: number) {
    for (let color = 0; color < 3; color++) {
      for (let channel = 0; channel < 3; channel++) {
        this.colors[color][channel] = lerp(this.colors[color][channel], this.target[color][channel], amount)
      }
    }
    this.warp = lerp(this.warp, this.look.warp, amount)
    this.mediaMix = lerp(this.mediaMix, this.look.mediaMix, amount)
  }
}
