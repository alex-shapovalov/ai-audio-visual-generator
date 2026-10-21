import { errorMessage } from "@/lib/error-message"
import { heuristicLook } from "@/lib/look-heuristic"
import type { LookRequest, LookResponse } from "@/lib/look-schema"
import { KEY_HEADER } from "@/lib/openrouter"

export const requestLook = async (request: LookRequest, key: string): Promise<LookResponse> => {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (key) headers[KEY_HEADER] = key
  const response = await fetch("/api/look", {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`The look service returned ${response.status}`)
  return (await response.json()) as LookResponse
}

export const requestLookOrFallback = async (
  request: LookRequest,
  key: string,
): Promise<LookResponse> => {
  try {
    return await requestLook(request, key)
  } catch (error) {
    const local = heuristicLook(request)
    return { ...local, note: errorMessage(error, "The look service is unreachable") }
  }
}
