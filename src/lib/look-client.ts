import { errorMessage } from "@/lib/error-message"
import { heuristicLook } from "@/lib/look-heuristic"
import type { LookRequest, LookResponse } from "@/lib/look-schema"

export const requestLook = async (request: LookRequest): Promise<LookResponse> => {
  const response = await fetch("/api/look", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`The look service returned ${response.status}`)
  return (await response.json()) as LookResponse
}

export const requestLookOrFallback = async (request: LookRequest): Promise<LookResponse> => {
  try {
    return await requestLook(request)
  } catch (error) {
    const local = heuristicLook(request)
    return { ...local, note: errorMessage(error, "The look service is unreachable") }
  }
}
