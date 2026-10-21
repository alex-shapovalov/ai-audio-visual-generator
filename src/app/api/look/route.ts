import { heuristicLook } from "@/lib/look-heuristic"
import { sanitizeLook, type LookRequest, type LookResponse, type MediaRef } from "@/lib/look-schema"
import { DEFAULT_MODEL, KEY_HEADER } from "@/lib/openrouter"
import type { TrackStats } from "@/lib/types"

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const TIMEOUT_MS = 25000

const SYSTEM_PROMPT = `You are the lighting and visuals director for a live electronic music set (EDM, tech house, dubstep, trance).
Choose a visual look for a track or for a description the DJ typed. Reply with one JSON object and nothing else.

Fields:
- "scene": one of "portal" (tunnel that opens in breakdowns, melodic and trance), "grid" (perspective grid corridor, tech house and minimal), "strobe" (concentric geometry flashing on the kick, hard and driving), "rift" (glitching horizontal slices shoved by the bass, dubstep and bass music), "media" (the DJ's own uploaded media full-frame, only when media exists).
- "colors": exactly three hex colors "#rrggbb": a bright accent, a secondary accent, then a very dark background tone.
- "mediaId": the id of one uploaded media item to layer in, or null.
- "mediaMix": 0 to 1, how strongly the media shows through.
- "strobe": true only for hard-hitting tracks; flashes are capped and the DJ can disable them.
- "warp": 0 to 1, how much bass distorts the picture.
- "kaleido": true to mirror media into a kaleidoscope.
- "reason": one short sentence explaining the choice.`

type ChatResponse = {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

const parseJson = (content: string): unknown => {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(trimmed)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isMediaRef = (value: unknown): value is MediaRef =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string"

const isOptionalString = (value: unknown) => value === undefined || typeof value === "string"

const isTrackStats = (value: unknown): value is TrackStats =>
  isRecord(value) &&
  Number.isFinite(value.duration) &&
  Number.isFinite(value.brightness) &&
  Number.isFinite(value.bass)

const isRequest = (value: unknown): value is LookRequest =>
  isRecord(value) &&
  Array.isArray(value.media) &&
  value.media.every(isMediaRef) &&
  isOptionalString(value.prompt) &&
  isOptionalString(value.title) &&
  (value.stats === undefined || isTrackStats(value.stats))

const describeStats = (stats: TrackStats | undefined) =>
  stats
    ? {
        durationSeconds: Math.round(stats.duration),
        bassShare: Number(stats.bass.toFixed(3)),
        trebleShare: Number(stats.brightness.toFixed(3)),
      }
    : null

const askOpenRouter = async (request: LookRequest, key: string, model: string) => {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "Afterimage",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            trackTitle: request.title ?? null,
            djPrompt: request.prompt ?? null,
            trackStats: describeStats(request.stats),
            uploadedMedia: request.media,
          }),
        },
      ],
    }),
  })

  const data = (await response.json().catch(() => ({}))) as ChatResponse
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenRouter returned ${response.status}`)
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenRouter returned an empty reply")
  return parseJson(content) as Record<string, unknown>
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!isRequest(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const key = request.headers.get(KEY_HEADER) || process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL

  if (!key) {
    const local = heuristicLook(body)
    return Response.json({ ...local, note: "No OpenRouter key configured" } satisfies LookResponse)
  }

  try {
    const raw = await askOpenRouter(body, key, model)
    const look = sanitizeLook(raw, body.media.map((item) => item.id))
    const reason = typeof raw.reason === "string" ? raw.reason.slice(0, 240) : ""
    return Response.json({ look, reason, source: "openrouter" } satisfies LookResponse)
  } catch (error) {
    const local = heuristicLook(body)
    const message = error instanceof Error ? error.message : "OpenRouter request failed"
    return Response.json({ ...local, note: message } satisfies LookResponse)
  }
}
