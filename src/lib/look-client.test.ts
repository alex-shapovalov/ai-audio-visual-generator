import { afterEach, describe, expect, it, vi } from "vitest"
import { requestLook, requestLookOrFallback } from "@/lib/look-client"
import { DEFAULT_LOOK } from "@/lib/palettes"

const fetchMock = vi.fn<typeof fetch>()

const answer = (body: unknown, status = 200) =>
  fetchMock.mockImplementation(async () => Response.json(body, { status }))

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const request = { prompt: "acid green", media: [{ id: "a", name: "a.png" }] }

describe("requestLook", () => {
  it("posts the request as JSON and returns the parsed response", async () => {
    vi.stubGlobal("fetch", fetchMock)
    const response = { look: DEFAULT_LOOK, reason: "fits", source: "openrouter" }
    answer(response)

    await expect(requestLook(request)).resolves.toEqual(response)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/look")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({ "content-type": "application/json" })
    expect(JSON.parse(String(init?.body))).toEqual(request)
  })

  it("throws with the status code when the service fails", async () => {
    vi.stubGlobal("fetch", fetchMock)
    answer({ error: "Invalid request body" }, 400)
    await expect(requestLook(request)).rejects.toThrow("returned 400")
  })

  it("propagates a network failure", async () => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(requestLook(request)).rejects.toThrow("Failed to fetch")
  })
})

describe("requestLookOrFallback", () => {
  const dubstep = { prompt: "filthy dubstep drop", media: [] }

  it("returns the service answer when it works", async () => {
    vi.stubGlobal("fetch", fetchMock)
    const response = { look: DEFAULT_LOOK, reason: "fits", source: "openrouter" }
    answer(response)
    await expect(requestLookOrFallback(dubstep)).resolves.toEqual(response)
  })

  it("uses the local heuristic with a note when the service is unreachable", async () => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    const result = await requestLookOrFallback(dubstep)

    expect(result.source).toBe("heuristic")
    expect(result.look.scene).toBe("rift")
    expect(result.note).toBe("Failed to fetch")
  })

  it("uses the local heuristic with a note when the service errors", async () => {
    vi.stubGlobal("fetch", fetchMock)
    answer({ error: "boom" }, 500)

    const result = await requestLookOrFallback(dubstep)

    expect(result.source).toBe("heuristic")
    expect(result.note).toContain("500")
  })
})
