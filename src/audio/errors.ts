const MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Microphone access was denied. Allow it in the browser's site settings, then connect again.",
  PermissionDeniedError:
    "Microphone access was denied. Allow it in the browser's site settings, then connect again.",
  NotFoundError: "No audio input was found. Plug in your interface and connect again.",
  NotReadableError:
    "That input is busy or unavailable. Close other apps using it, then try again.",
  AbortError: "That input is busy or unavailable. Close other apps using it, then try again.",
  OverconstrainedError: "That input is no longer available. Reconnect it and connect again.",
  SecurityError: "Audio capture needs a secure page (https or localhost).",
  EncodingError: "This file could not be decoded as audio.",
}

export const describeAudioError = (error: unknown): string => {
  const name = (error as { name?: unknown } | null)?.name
  if (typeof name === "string" && Object.hasOwn(MESSAGES, name)) return MESSAGES[name]
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong with the audio input."
}
