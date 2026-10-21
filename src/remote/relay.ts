import crypto from "node:crypto"
import http from "node:http"
import os from "node:os"
import { isHexColor } from "../lib/palettes.ts"
import { SCENES, type Look, type SceneId } from "../lib/types.ts"
import type { Command } from "./protocol.ts"

export type RelayOptions = {
  token: string
  nextOrigin: string
  trustLoopback?: boolean
  lanUrls?: (port: number) => string[]
}

const COOKIE = "afterimage-remote"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const MAX_BODY_BYTES = 64 * 1024
const MAX_ID_LENGTH = 128
const HEARTBEAT_MS = 15_000
const PROXY_TIMEOUT_MS = 10_000
const PROXIED_PATHS: ReadonlySet<string> = new Set(["/remote", "/favicon.ico"])
const PROXIED_PREFIX = "/_next/static/"
const FORWARDED_HEADERS = ["accept", "accept-encoding", "accept-language", "if-none-match", "if-modified-since", "range", "user-agent"]
const HOP_BY_HOP_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "set-cookie",
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isScene = (value: unknown): value is SceneId => SCENES.some((scene) => scene === value)

const isUnit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1

const vetPatch = (value: unknown): Partial<Look> | null => {
  if (!isRecord(value)) return null
  const patch: Partial<Look> = {}
  const { colors } = value
  if (Array.isArray(colors) && colors.length === 3 && colors.every(isHexColor)) {
    patch.colors = [colors[0], colors[1], colors[2]]
  }
  if (isUnit(value.warp)) patch.warp = value.warp
  if (isUnit(value.mediaMix)) patch.mediaMix = value.mediaMix
  if (typeof value.kaleido === "boolean") patch.kaleido = value.kaleido
  if (typeof value.strobe === "boolean") patch.strobe = value.strobe
  return Object.keys(patch).length > 0 ? patch : null
}

export const vetCommand = (value: unknown): Command | null => {
  if (!isRecord(value)) return null
  switch (value.type) {
    case "scene":
      return isScene(value.scene) ? { type: "scene", scene: value.scene } : null
    case "patch": {
      const patch = vetPatch(value.patch)
      return patch ? { type: "patch", patch } : null
    }
    case "media":
      if (value.mediaId === null) return { type: "media", mediaId: null }
      if (typeof value.mediaId === "string" && value.mediaId.length <= MAX_ID_LENGTH) {
        return { type: "media", mediaId: value.mediaId }
      }
      return null
    case "auto":
      return typeof value.enabled === "boolean" ? { type: "auto", enabled: value.enabled } : null
    case "strobe-master":
      return value.enabled === false ? { type: "strobe-master", enabled: false } : null
    default:
      return null
  }
}

export const isLoopback = (address: string | undefined) =>
  address !== undefined && (address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127."))

export const generateToken = () => crypto.randomBytes(16).toString("hex")

const tokensMatch = (expected: string, given: string | null | undefined) => {
  if (given === null || given === undefined) return false
  const wanted = Buffer.from(expected)
  const offered = Buffer.from(given)
  return wanted.length === offered.length && crypto.timingSafeEqual(wanted, offered)
}

const cookieValue = (header: string | undefined, name: string) => {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return rest.join("=")
  }
  return undefined
}

export const networkUrls = (port: number) =>
  Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}/`)

const readBody = (request: http.IncomingMessage) =>
  new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    request.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) tooLarge = true
      if (!tooLarge) chunks.push(chunk)
    })
    request.on("end", () => resolve(tooLarge ? null : Buffer.concat(chunks).toString("utf8")))
    request.on("error", () => resolve(null))
  })

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export const createRelay = (options: RelayOptions) => {
  const trustLoopback = options.trustLoopback ?? true
  const lanUrls = options.lanUrls ?? networkUrls
  const next = new URL(options.nextOrigin)
  const localOrigins: ReadonlySet<string> = new Set([`http://127.0.0.1:${next.port}`, `http://localhost:${next.port}`])
  const displays = new Set<http.ServerResponse>()
  const controllers = new Set<http.ServerResponse>()
  let lastSnapshot: string | null = null

  const reply = (response: http.ServerResponse, status: number, body = "", headers: http.OutgoingHttpHeaders = {}) => {
    response.writeHead(status, { "cache-control": "no-store", ...headers })
    response.end(body)
  }

  const accessFor = (request: http.IncomingMessage) => {
    const origin = request.headers.origin
    const own = `http://${request.headers.host}`
    if (trustLoopback && isLoopback(request.socket.remoteAddress)) {
      const known = origin === undefined || origin === own || localOrigins.has(origin)
      return known ? "local" : null
    }
    if (!tokensMatch(options.token, cookieValue(request.headers.cookie, COOKIE))) return null
    return origin === undefined || origin === own ? "paired" : null
  }

  const corsFor = (request: http.IncomingMessage): http.OutgoingHttpHeaders => {
    const origin = request.headers.origin
    return origin !== undefined && localOrigins.has(origin)
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : {}
  }

  const broadcast = (clients: Set<http.ServerResponse>, event: string, data: string) => {
    for (const client of clients) {
      if (!client.writableNeedDrain) client.write(`event: ${event}\ndata: ${data}\n\n`)
    }
  }

  const subscribe = (
    response: http.ServerResponse,
    clients: Set<http.ServerResponse>,
    headers: http.OutgoingHttpHeaders,
  ) => {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...headers,
    })
    response.write(": connected\n\n")
    clients.add(response)
    response.on("close", () => {
      clients.delete(response)
      if (displays.size === 0) lastSnapshot = null
    })
  }

  const forward = (url: URL, request: http.IncomingMessage, response: http.ServerResponse) => {
    const headers: http.OutgoingHttpHeaders = {}
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers[name]
      if (value !== undefined) headers[name] = value
    }
    const upstream = http.request(
      {
        hostname: next.hostname,
        port: next.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
        timeout: PROXY_TIMEOUT_MS,
      },
      (answer) => {
        const passed: http.OutgoingHttpHeaders = {}
        for (const [name, value] of Object.entries(answer.headers)) {
          if (!HOP_BY_HOP_HEADERS.has(name)) passed[name] = value
        }
        response.writeHead(answer.statusCode ?? 502, passed)
        answer.pipe(response)
      },
    )
    upstream.on("timeout", () => upstream.destroy())
    upstream.on("error", () => {
      if (response.headersSent) {
        response.destroy()
      } else {
        reply(response, 502, "The Afterimage app is not reachable.")
      }
    })
    upstream.end()
  }

  const handle = async (request: http.IncomingMessage, response: http.ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
    const method = request.method ?? "GET"
    const access = accessFor(request)
    const isLocal = access === "local"

    if (method === "GET" && url.pathname === "/") {
      if (tokensMatch(options.token, url.searchParams.get("token"))) {
        const cookie = `${COOKIE}=${options.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`
        return reply(response, 302, "", { location: "/remote", "set-cookie": cookie })
      }
      if (access) return reply(response, 302, "", { location: "/remote" })
      return reply(response, 401, "Open the pairing link from the Afterimage controls window.")
    }

    if (method === "GET" && url.pathname === "/info") {
      if (!isLocal) return reply(response, 401)
      const body = JSON.stringify({ urls: lanUrls(Number(request.socket.localPort)), token: options.token })
      return reply(response, 200, body, { "content-type": "application/json", ...corsFor(request) })
    }

    if (method === "GET" && url.pathname === "/events") {
      if (url.searchParams.get("role") === "display") {
        if (!isLocal) return reply(response, 401)
        return subscribe(response, displays, corsFor(request))
      }
      if (!access) return reply(response, 401)
      subscribe(response, controllers, {})
      if (lastSnapshot !== null) broadcast(new Set([response]), "snapshot", lastSnapshot)
      return undefined
    }

    if (method === "POST" && url.pathname === "/snapshot") {
      if (!isLocal) return reply(response, 401)
      const body = await readBody(request)
      if (body === null) return reply(response, 413, "", corsFor(request))
      const snapshot = parseJson(body)
      if (!isRecord(snapshot)) return reply(response, 400, "", corsFor(request))
      lastSnapshot = JSON.stringify(snapshot)
      broadcast(controllers, "snapshot", lastSnapshot)
      return reply(response, 204, "", corsFor(request))
    }

    if (method === "POST" && url.pathname === "/command") {
      if (!access) return reply(response, 401)
      const body = await readBody(request)
      if (body === null) return reply(response, 413)
      const command = vetCommand(parseJson(body))
      if (!command) return reply(response, 400, "That command is not allowed from a remote.")
      broadcast(displays, "command", JSON.stringify(command))
      return reply(response, 204)
    }

    const proxied = PROXIED_PATHS.has(url.pathname) || url.pathname.startsWith(PROXIED_PREFIX)
    if (method === "GET" && proxied) {
      if (!access) return reply(response, 401)
      return forward(url, request, response)
    }

    return reply(response, 404)
  }

  const server = http.createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) reply(response, 500)
      else response.destroy()
    })
  })

  const heartbeat = setInterval(() => {
    for (const client of [...displays, ...controllers]) client.write(": ping\n\n")
  }, HEARTBEAT_MS)
  heartbeat.unref()
  server.on("close", () => clearInterval(heartbeat))

  return server
}
