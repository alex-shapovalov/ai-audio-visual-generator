import { SCENES, type Frame, type Look, type SceneId } from "@/lib/types"
import { LookState } from "@/visuals/look-state"
import { FRAGMENT, SCENE_INDEX, VERTEX } from "@/visuals/shaders"

type Program = {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
}

type Resources = {
  programs: Map<SceneId, Program>
  texture: WebGLTexture
  vao: WebGLVertexArrayObject
}

export type MediaSource = {
  element: HTMLImageElement | HTMLVideoElement
  width: number
  height: number
}

const UNIFORMS = [
  "uRes",
  "uTime",
  "uTravel",
  "uAudio",
  "uPulse",
  "uA",
  "uB",
  "uC",
  "uWarp",
  "uKaleido",
  "uMediaMix",
  "uHasMedia",
  "uMediaAspect",
  "uMedia",
]

const MAX_PIXEL_RATIO = 1.5
const VIDEO_READY_STATE = 2

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string, label: string) => {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("Could not create a shader")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed (${label}): ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

const buildProgram = (gl: WebGL2RenderingContext, scene: SceneId): Program => {
  const fragment = FRAGMENT.replace(
    "precision highp float;",
    `precision highp float;\n#define SCENE ${SCENE_INDEX[scene]}`,
  )
  const program = gl.createProgram()
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX, `${scene} vertex`))
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragment, `${scene} fragment`))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed (${scene}): ${gl.getProgramInfoLog(program)}`)
  }
  const uniforms: Program["uniforms"] = {}
  for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name)
  return { program, uniforms }
}

const createTexture = (gl: WebGL2RenderingContext) => {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  return texture
}

export class Renderer {
  private readonly gl: WebGL2RenderingContext
  private readonly state = new LookState()
  private resources: Resources | null
  private media: MediaSource | null = null
  private strobeEnabled = false
  private running = false
  private raf = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly frame: Frame,
    private readonly onFrame: (now: number) => void,
  ) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    })
    if (!gl) throw new Error("WebGL2 is not available in this browser")
    this.gl = gl
    this.resources = this.createResources()
    canvas.addEventListener("webglcontextlost", this.handleContextLost)
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored)
  }

  private createResources(): Resources {
    const gl = this.gl
    const programs = new Map<SceneId, Program>()
    for (const scene of SCENES) programs.set(scene, buildProgram(gl, scene))
    return { programs, texture: createTexture(gl), vao: gl.createVertexArray() }
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault()
    this.resources = null
  }

  private handleContextRestored = () => {
    this.resources = this.createResources()
    this.uploadMedia()
  }

  private uploadMedia() {
    const media = this.media
    if (!media || !this.resources) return
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.resources.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media.element)
  }

  setMedia(media: MediaSource | null) {
    this.media = media
    if (media && !(media.element instanceof HTMLVideoElement)) this.uploadMedia()
  }

  setStrobeEnabled(enabled: boolean) {
    this.strobeEnabled = enabled
  }

  setLook(look: Look, immediate = false) {
    this.state.setLook(look, immediate, performance.now())
  }

  start() {
    if (this.running) return
    this.running = true
    const loop = (now: number) => {
      if (!this.running) return
      this.raf = requestAnimationFrame(loop)
      this.onFrame(now)
      this.draw(now)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  dispose() {
    this.stop()
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost)
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored)
  }

  private resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio))
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  private draw(now: number) {
    this.state.advance(now, this.frame)
    const resources = this.resources
    if (!resources) return
    this.resize()

    const { gl, frame, state } = this
    const hasMedia = this.media !== null && state.look.mediaId !== null
    const sceneId: SceneId = state.scene === "media" && !hasMedia ? "portal" : state.scene
    const entry = resources.programs.get(sceneId)
    if (!entry) return

    if (hasMedia && this.media?.element instanceof HTMLVideoElement) {
      if (this.media.element.readyState >= VIDEO_READY_STATE) this.uploadMedia()
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(entry.program)
    gl.bindVertexArray(resources.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, resources.texture)

    const u = entry.uniforms
    const strobeArmed = state.look.strobe && this.strobeEnabled
    const aspect = this.media ? this.media.width / Math.max(1, this.media.height) : 1
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.uTime, now / 1000)
    gl.uniform1f(u.uTravel, state.travel)
    gl.uniform4f(u.uAudio, frame.sub, frame.low, frame.mid, frame.air)
    gl.uniform4f(u.uPulse, frame.kick, state.open, state.dropFlash, strobeArmed ? 1 : 0)
    gl.uniform3fv(u.uA, state.colors[0])
    gl.uniform3fv(u.uB, state.colors[1])
    gl.uniform3fv(u.uC, state.colors[2])
    gl.uniform1f(u.uWarp, state.warp)
    gl.uniform1f(u.uKaleido, state.look.kaleido ? 1 : 0)
    gl.uniform1f(u.uMediaMix, sceneId === "media" ? 1 : state.mediaMix)
    gl.uniform1f(u.uHasMedia, hasMedia ? 1 : 0)
    gl.uniform1f(u.uMediaAspect, aspect)
    gl.uniform1i(u.uMedia, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
