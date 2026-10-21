import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/look/route"
import type { LookResponse } from "@/lib/look-schema"

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const TEST_KEY = "test-key-not-real"
const MEDIA = [{ id: "clip", name: "clip.mp4" }]

const fetchMock = vi.fn<typeof fetch>()

const call = (body: unknown) =>
  POST(
    new Request("http://localhost/api/look", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )

const reply = (content: string) => Response.json({ choices: [{ message: { content } }] })

const modelLook = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    scene: "rift",
    colors: ["#b6ff1a", "#ff1fa8", "#12001f"],
    mediaId: null,
    mediaMix: 0.5,
    strobe: true,
    warp: 0.8,
    kaleido: false,
    reason: "Bass-heavy, so the rift scene fits.",
    ...overrides,
  })

const json = async (response: Response) => (await response.json()) as LookResponse

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockRejectedValue(new Error("unexpected network call"))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("OPENROUTER_API_KEY", TEST_KEY)
  vi.stubEnv("OPENROUTER_MODEL", "")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("POST /api/look request validation", () => {
  it.each([
    ["malformed JSON", "{not json"],
    ["a JSON array", []],
    ["a missing media list", { prompt: "dubstep" }],
    ["a media list that is not an array", { media: "none" }],
    ["a media item without a name", { media: [{ id: "a" }] }],
    ["a media item that is null", { media: [null] }],
    ["a numeric prompt", { prompt: 42, media: [] }],
    ["a numeric title", { title: 7, media: [] }],
    ["stats with a missing field", { stats: { duration: 1, bass: 0.5 }, media: [] }],
    ["stats with a non-numeric field", { stats: { duration: "1", bass: 0.5, brightness: 0.1 }, media: [] }],
  ])("returns 400 for %s and never calls OpenRouter", async (_name, body) => {
    const response = await call(body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid request body" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts an empty media list with no other fields", async () => {
    fetchMock.mockResolvedValue(reply(modelLook()))
    const response = await call({ media: [] })
    expect(response.status).toBe(200)
  })
})

describe("POST /api/look with OpenRouter", () => {
  it("returns the sanitized model look", async () => {
    fetchMock.mockResolvedValue(
      reply(modelLook({ scene: "media", mediaId: "clip", mediaMix: 7, warp: -2, strobe: "yes" })),
    )
    const response = await call({ prompt: "my clip, loud", media: MEDIA })
    const data = await json(response)

    expect(response.status).toBe(200)
    expect(data.source).toBe("openrouter")
    expect(data.note).toBeUndefined()
    expect(data.reason).toBe("Bass-heavy, so the rift scene fits.")
    expect(data.look).toEqual({
      scene: "media",
      colors: ["#b6ff1a", "#ff1fa8", "#12001f"],
      mediaId: "clip",
      mediaMix: 1,
      strobe: false,
      warp: 0,
      kaleido: false,
    })
  })

  it("drops a media id the model invented and downgrades the media scene", async () => {
    fetchMock.mockResolvedValue(reply(modelLook({ scene: "media", mediaId: "invented" })))
    const data = await json(await call({ prompt: "x", media: MEDIA }))
    expect(data.source).toBe("openrouter")
    expect(data.look.mediaId).toBeNull()
    expect(data.look.scene).toBe("portal")
  })

  it("accepts a reply wrapped in a json code fence", async () => {
    fetchMock.mockResolvedValue(reply("```json\n" + modelLook() + "\n```"))
    const data = await json(await call({ prompt: "x", media: [] }))
    expect(data.source).toBe("openrouter")
    expect(data.look.scene).toBe("rift")
  })

  it("truncates a very long reason", async () => {
    fetchMock.mockResolvedValue(reply(modelLook({ reason: "r".repeat(1000) })))
    const data = await json(await call({ prompt: "x", media: [] }))
    expect(data.reason).toHaveLength(240)
  })

  it("sends the documented request to OpenRouter", async () => {
    fetchMock.mockResolvedValue(reply(modelLook()))
    await call({
      title: "Warehouse 126",
      prompt: "dark",
      stats: { duration: 312.4, bass: 0.55555, brightness: 0.04444 },
      media: MEDIA,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(init?.method).toBe("POST")
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${TEST_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Afterimage",
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)

    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      model: "openai/gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 400,
      response_format: { type: "json_object" },
    })
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe("system")
    expect(JSON.parse(body.messages[1].content)).toEqual({
      trackTitle: "Warehouse 126",
      djPrompt: "dark",
      trackStats: { durationSeconds: 312, bassShare: 0.556, trebleShare: 0.044 },
      uploadedMedia: MEDIA,
    })
  })

  it("sends nulls for fields the caller omitted", async () => {
    fetchMock.mockResolvedValue(reply(modelLook()))
    await call({ media: [] })
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(JSON.parse(body.messages[1].content)).toEqual({
      trackTitle: null,
      djPrompt: null,
      trackStats: null,
      uploadedMedia: [],
    })
  })

  it("uses the model from the environment", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/claude-test")
    fetchMock.mockResolvedValue(reply(modelLook()))
    await call({ media: [] })
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.model).toBe("anthropic/claude-test")
  })

  it("authenticates with the environment key and ignores any key header from the caller", async () => {
    fetchMock.mockResolvedValue(reply(modelLook()))
    await POST(
      new Request("http://localhost/api/look", {
        method: "POST",
        headers: { "content-type": "application/json", "x-openrouter-key": "caller-key-not-real" },
        body: JSON.stringify({ media: [] }),
      }),
    )
    const init = fetchMock.mock.calls[0][1]
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TEST_KEY}` })
  })
})

describe("POST /api/look fallbacks", () => {
  it("uses the local heuristic with a note when no key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    const response = await call({ prompt: "filthy dubstep drop", media: [] })
    const data = await json(response)

    expect(response.status).toBe(200)
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("No OpenRouter key configured")
    expect(data.look.scene).toBe("rift")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back with the provider message on an HTTP error", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { message: "Rate limit exceeded" } }, { status: 429 }),
    )
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("Rate limit exceeded")
    expect(data.look.scene).toBe("portal")
  })

  it("falls back with the status code when the error body has no message", async () => {
    fetchMock.mockResolvedValue(new Response("upstream exploded", { status: 502 }))
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("OpenRouter returned 502")
  })

  it("falls back when the model reply is not JSON", async () => {
    fetchMock.mockResolvedValue(reply("Sure! Here is a cool look."))
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toEqual(expect.any(String))
    expect(data.note).not.toBe("")
  })

  it("falls back when the model reply is empty", async () => {
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "" } }] }))
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("OpenRouter returned an empty reply")
  })

  it("falls back when the response has no choices", async () => {
    fetchMock.mockResolvedValue(Response.json({}))
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("OpenRouter returned an empty reply")
  })

  it("falls back when the network call fails", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"))
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("fetch failed")
  })

  it("falls back with a generic note when a non-error is thrown", async () => {
    fetchMock.mockRejectedValue("boom")
    const data = await json(await call({ prompt: "trance", media: [] }))
    expect(data.source).toBe("heuristic")
    expect(data.note).toBe("OpenRouter request failed")
  })

  it("keeps the heuristic media choice in the fallback look", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    const data = await json(await call({ prompt: "show my clip", media: MEDIA }))
    expect(data.look.scene).toBe("media")
    expect(data.look.mediaId).toBe("clip")
  })
})
