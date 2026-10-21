import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/remote/config/route"

vi.mock("next/server", () => ({ connection: async () => undefined }))

afterEach(() => {
  vi.unstubAllEnvs()
})

const relayPort = async () => ((await (await GET()).json()) as { relayPort: number | null }).relayPort

describe("GET /api/remote/config", () => {
  it("reports the relay port when one is configured", async () => {
    vi.stubEnv("AFTERIMAGE_RELAY_PORT", "4618")
    expect(await relayPort()).toBe(4618)
  })

  it.each(["", "abc", "0", "-5", "46.5"])("reports no relay for %j", async (value) => {
    vi.stubEnv("AFTERIMAGE_RELAY_PORT", value)
    expect(await relayPort()).toBeNull()
  })

  it("reports no relay when nothing is configured", async () => {
    vi.stubEnv("AFTERIMAGE_RELAY_PORT", undefined)
    expect(await relayPort()).toBeNull()
  })
})
