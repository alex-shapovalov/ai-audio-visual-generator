import http from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { SCENES } from "@/lib/types"
import { createRelay, generateToken, isLoopback, vetCommand } from "@/remote/relay"

const TOKEN = "0123456789abcdef0123456789abcdef"
const COOKIE = `afterimage-remote=${TOKEN}`
const JSON_HEADERS = { "content-type": "application/json" }

const servers: http.Server[] = []

const listen = async (server: http.Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  servers.push(server)
  return (server.address() as AddressInfo).port
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        }),
    ),
  )
})

const startRelay = async (trustLoopback: boolean) => {
  const hits: string[] = []
  const upstream = http.createServer((request, response) => {
    hits.push(request.url ?? "")
    response.setHeader("set-cookie", "upstream=1")
    response.end("remote page")
  })
  const upstreamPort = await listen(upstream)
  const relay = createRelay({
    token: TOKEN,
    nextOrigin: `http://127.0.0.1:${upstreamPort}`,
    trustLoopback,
    lanUrls: (port) => [`http://192.0.2.10:${port}/`],
  })
  const port = await listen(relay)
  return { base: `http://127.0.0.1:${port}`, port, hits, upstreamPort }
}

const call = (url: string, init: RequestInit = {}) => fetch(url, { redirect: "manual", ...init })

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  call(url, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })

const openStream = (url: string, headers: Record<string, string> = {}) =>
  new Promise<{ status: number; text: () => string; close: () => void }>((resolve) => {
    const request = http.get(url, { headers }, (response) => {
      let received = ""
      response.setEncoding("utf8")
      response.on("data", (chunk: string) => {
        received += chunk
      })
      resolve({ status: response.statusCode ?? 0, text: () => received, close: () => request.destroy() })
    })
    request.on("error", () => undefined)
  })

const until = async (predicate: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the relay")
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const quiet = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const rawGet = (port: number, path: string, headers: Record<string, string> = {}) =>
  new Promise<number>((resolve) => {
    http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })
  })

describe("vetCommand", () => {
  it.each(SCENES)("accepts the %s scene", (scene) => {
    expect(vetCommand({ type: "scene", scene })).toEqual({ type: "scene", scene })
  })

  it.each([
    ["an unknown scene", { type: "scene", scene: "kaleidoscope" }],
    ["a missing scene", { type: "scene" }],
    ["a numeric scene", { type: "scene", scene: 3 }],
  ])("rejects %s", (_name, command) => {
    expect(vetCommand(command)).toBeNull()
  })

  it("keeps only the valid look fields of a patch", () => {
    const patch = {
      colors: ["#112233", "#abc", "#FFEEDD"],
      warp: 0.5,
      mediaMix: 1,
      kaleido: true,
      strobe: false,
      scene: "rift",
      mediaId: "stolen",
      extra: "ignored",
    }
    expect(vetCommand({ type: "patch", patch })).toEqual({
      type: "patch",
      patch: { colors: ["#112233", "#abc", "#FFEEDD"], warp: 0.5, mediaMix: 1, kaleido: true, strobe: false },
    })
  })

  it("drops out-of-range and mistyped patch fields, and rejects a patch with nothing valid", () => {
    expect(vetCommand({ type: "patch", patch: { warp: 1.5, mediaMix: -1, kaleido: "yes", colors: ["red", "#000", "#111"] } })).toBeNull()
    expect(vetCommand({ type: "patch", patch: { warp: 2, kaleido: true } })).toEqual({
      type: "patch",
      patch: { kaleido: true },
    })
    expect(vetCommand({ type: "patch", patch: {} })).toBeNull()
    expect(vetCommand({ type: "patch", patch: "warp" })).toBeNull()
    expect(vetCommand({ type: "patch", patch: { colors: ["#000", "#111"] } })).toBeNull()
  })

  it("accepts a media id or none, and rejects anything else", () => {
    expect(vetCommand({ type: "media", mediaId: null })).toEqual({ type: "media", mediaId: null })
    expect(vetCommand({ type: "media", mediaId: "clip-1" })).toEqual({ type: "media", mediaId: "clip-1" })
    expect(vetCommand({ type: "media", mediaId: "x".repeat(129) })).toBeNull()
    expect(vetCommand({ type: "media", mediaId: 4 })).toBeNull()
    expect(vetCommand({ type: "media" })).toBeNull()
  })

  it("accepts auto cues as a boolean only", () => {
    expect(vetCommand({ type: "auto", enabled: true })).toEqual({ type: "auto", enabled: true })
    expect(vetCommand({ type: "auto", enabled: false })).toEqual({ type: "auto", enabled: false })
    expect(vetCommand({ type: "auto", enabled: "yes" })).toBeNull()
  })

  it("lets a remote switch the strobe master off but never on", () => {
    expect(vetCommand({ type: "strobe-master", enabled: false })).toEqual({ type: "strobe-master", enabled: false })
    expect(vetCommand({ type: "strobe-master", enabled: true })).toBeNull()
    expect(vetCommand({ type: "strobe-master" })).toBeNull()
    expect(vetCommand({ type: "strobe-master", enabled: "false" })).toBeNull()
  })

  it.each([
    ["listen", { type: "listen", deviceId: "a", label: "b" }],
    ["play-file", { type: "play-file", file: "x" }],
    ["show", { type: "show", look: {}, immediate: true }],
    ["forget-media", { type: "forget-media", id: "a" }],
    ["demo", { type: "demo" }],
    ["stop", { type: "stop" }],
    ["an unknown type", { type: "reboot" }],
  ])("refuses the %s command from a remote", (_name, command) => {
    expect(vetCommand(command)).toBeNull()
  })

  it.each([null, undefined, "scene", 7, [], [{ type: "scene", scene: "rift" }]])("rejects %j", (value) => {
    expect(vetCommand(value)).toBeNull()
  })
})

describe("isLoopback", () => {
  it.each(["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"])("treats %s as this machine", (address) => {
    expect(isLoopback(address)).toBe(true)
  })

  it.each([undefined, "", "192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "fe80::1", "128.0.0.1"])(
    "does not trust %j",
    (address) => {
      expect(isLoopback(address)).toBe(false)
    },
  )
})

describe("generateToken", () => {
  it("makes a long random hex token each time", () => {
    const first = generateToken()
    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(generateToken()).not.toBe(first)
  })
})

describe("relay for clients on the network", () => {
  it("asks for the pairing link when there is no valid token", async () => {
    const { base } = await startRelay(false)

    const bare = await call(`${base}/`)
    const wrong = await call(`${base}/?token=${"f".repeat(32)}`)
    const short = await call(`${base}/?token=abc`)

    expect(bare.status).toBe(401)
    expect(await bare.text()).toContain("pairing link")
    expect(wrong.status).toBe(401)
    expect(short.status).toBe(401)
  })

  it("pairs with the token by setting a strict http-only cookie and redirecting to the remote", async () => {
    const { base } = await startRelay(false)

    const response = await call(`${base}/?token=${TOKEN}`)

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/remote")
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`afterimage-remote=${TOKEN}`)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Strict")
  })

  it("sends a paired visitor straight on to the remote page", async () => {
    const { base } = await startRelay(false)
    const response = await call(`${base}/`, { headers: { cookie: COOKIE } })
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/remote")
  })

  it("only accepts commands from a paired client, and only allowed ones", async () => {
    const { base } = await startRelay(false)
    const scene = { type: "scene", scene: "rift" }

    expect((await post(`${base}/command`, scene)).status).toBe(401)
    expect((await post(`${base}/command`, scene, { cookie: "afterimage-remote=wrong" })).status).toBe(401)
    expect((await post(`${base}/command`, scene, { cookie: COOKIE })).status).toBe(204)
    expect((await post(`${base}/command`, { type: "stop" }, { cookie: COOKIE })).status).toBe(400)
    expect((await post(`${base}/command`, { type: "strobe-master", enabled: true }, { cookie: COOKIE })).status).toBe(400)
    expect((await post(`${base}/command`, "{not json", { cookie: COOKIE })).status).toBe(400)
  })

  it("refuses a paired request that comes from another website", async () => {
    const { base } = await startRelay(false)
    const scene = { type: "scene", scene: "rift" }

    const foreign = await post(`${base}/command`, scene, { cookie: COOKIE, origin: "https://evil.example" })
    const own = await post(`${base}/command`, scene, { cookie: COOKIE, origin: base })

    expect(foreign.status).toBe(401)
    expect(own.status).toBe(204)
  })

  it("rejects an oversized command body", async () => {
    const { base } = await startRelay(false)
    const huge = JSON.stringify({ type: "scene", scene: "rift", padding: "x".repeat(70_000) })
    expect((await post(`${base}/command`, huge, { cookie: COOKIE })).status).toBe(413)
  })

  it("keeps the display-only endpoints closed even to a paired client", async () => {
    const { base } = await startRelay(false)
    const headers = { cookie: COOKIE }

    expect((await call(`${base}/info`, { headers })).status).toBe(401)
    expect((await post(`${base}/snapshot`, { look: {} }, headers)).status).toBe(401)
    const display = await openStream(`${base}/events?role=display`, headers)
    expect(display.status).toBe(401)
  })

  it("streams to a paired controller and refuses an unpaired one", async () => {
    const { base } = await startRelay(false)

    const unpaired = await openStream(`${base}/events`)
    const paired = await openStream(`${base}/events`, { cookie: COOKIE })

    expect(unpaired.status).toBe(401)
    expect(paired.status).toBe(200)
    paired.close()
  })

  it("serves only the remote page and its assets from the app", async () => {
    const { base, port, hits } = await startRelay(false)
    const headers = { cookie: COOKIE }

    expect((await call(`${base}/remote`)).status).toBe(401)
    expect(hits).toEqual([])

    const page = await call(`${base}/remote`, { headers })
    expect(page.status).toBe(200)
    expect(await page.text()).toBe("remote page")
    expect(page.headers.get("set-cookie")).toBeNull()

    expect((await call(`${base}/_next/static/chunks/app.js`, { headers })).status).toBe(200)
    expect(hits).toEqual(["/remote", "/_next/static/chunks/app.js"])

    expect((await call(`${base}/api/look`, { headers })).status).toBe(404)
    expect((await call(`${base}/display`, { headers })).status).toBe(404)
    expect((await call(`${base}/remote`, { method: "POST", headers })).status).toBe(404)
    expect(await rawGet(port, "/_next/static/../../api/look", headers)).toBe(404)
    expect(await rawGet(port, "/_next/static/%2e%2e/%2e%2e/api/look", headers)).toBe(404)
    expect(hits).toEqual(["/remote", "/_next/static/chunks/app.js"])
  })

  it("reports a bad gateway when the app is down", async () => {
    const relay = createRelay({ token: TOKEN, nextOrigin: "http://127.0.0.1:9", trustLoopback: false })
    const port = await listen(relay)
    const response = await call(`http://127.0.0.1:${port}/remote`, { headers: { cookie: COOKIE } })
    expect(response.status).toBe(502)
  })
})

describe("relay for this machine", () => {
  it("lets the local pages read the pairing details, and nobody else", async () => {
    const { base, port, upstreamPort } = await startRelay(true)
    const allowed = `http://127.0.0.1:${upstreamPort}`

    const plain = await call(`${base}/info`)
    expect(plain.status).toBe(200)
    expect(await plain.json()).toEqual({ urls: [`http://192.0.2.10:${port}/`], token: TOKEN })

    const fromApp = await call(`${base}/info`, { headers: { origin: allowed } })
    expect(fromApp.status).toBe(200)
    expect(fromApp.headers.get("access-control-allow-origin")).toBe(allowed)
    expect(fromApp.headers.get("vary")).toBe("Origin")

    const fromLocalhost = await call(`${base}/info`, { headers: { origin: allowed.replace("127.0.0.1", "localhost") } })
    expect(fromLocalhost.status).toBe(200)

    const fromWebsite = await call(`${base}/info`, { headers: { origin: "https://evil.example" } })
    expect(fromWebsite.status).toBe(401)
  })

  it("does not let a website in this browser drive the display", async () => {
    const { base } = await startRelay(true)
    const headers = { origin: "https://evil.example" }

    expect((await post(`${base}/command`, { type: "scene", scene: "rift" }, headers)).status).toBe(401)
    expect((await post(`${base}/snapshot`, { look: {} }, headers)).status).toBe(401)
    const display = await openStream(`${base}/events?role=display`, headers)
    expect(display.status).toBe(401)
  })

  it("passes snapshots from the display to controllers and vetted commands the other way", async () => {
    const { base, upstreamPort } = await startRelay(true)
    const origin = `http://127.0.0.1:${upstreamPort}`
    const display = await openStream(`${base}/events?role=display`, { origin })
    const controller = await openStream(`${base}/events`)
    expect(display.status).toBe(200)
    expect(controller.status).toBe(200)

    expect((await post(`${base}/snapshot`, { auto: true, look: { scene: "bars" } }, { origin })).status).toBe(204)
    await until(() => controller.text().includes("event: snapshot"))
    expect(controller.text()).toContain('data: {"auto":true,"look":{"scene":"bars"}}')

    expect((await post(`${base}/command`, { type: "scene", scene: "lasers", extra: "dropped" })).status).toBe(204)
    await until(() => display.text().includes("event: command"))
    expect(display.text()).toContain('data: {"type":"scene","scene":"lasers"}')

    display.close()
    controller.close()
  })

  it("does not pass refused commands on to the display", async () => {
    const { base, upstreamPort } = await startRelay(true)
    const origin = `http://127.0.0.1:${upstreamPort}`
    const display = await openStream(`${base}/events?role=display`, { origin })

    expect((await post(`${base}/command`, { type: "strobe-master", enabled: true })).status).toBe(400)
    expect((await post(`${base}/command`, { type: "listen", deviceId: "a", label: "b" })).status).toBe(400)
    await quiet(100)

    expect(display.text()).not.toContain("event: command")
    display.close()
  })

  it("rejects a snapshot that is not a JSON object", async () => {
    const { base } = await startRelay(true)
    expect((await post(`${base}/snapshot`, "[1,2]")).status).toBe(400)
    expect((await post(`${base}/snapshot`, "nope")).status).toBe(400)
  })

  it("replays the latest snapshot to a controller that joins late, but not after the display has gone", async () => {
    const { base, upstreamPort } = await startRelay(true)
    const origin = `http://127.0.0.1:${upstreamPort}`
    const display = await openStream(`${base}/events?role=display`, { origin })
    await post(`${base}/snapshot`, { marker: "latest" }, { origin })

    const late = await openStream(`${base}/events`)
    await until(() => late.text().includes('"marker":"latest"'))

    display.close()
    await quiet(150)
    const afterwards = await openStream(`${base}/events`)
    await quiet(150)
    expect(afterwards.text()).not.toContain("event: snapshot")
    late.close()
    afterwards.close()
  })

  it("sends a paired visitor on without a token, since this machine is trusted", async () => {
    const { base } = await startRelay(true)
    const response = await call(`${base}/`)
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/remote")
  })
})
