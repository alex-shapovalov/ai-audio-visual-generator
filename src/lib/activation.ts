export const AUDIO_LOCKED_MESSAGE = "Click the display window once to allow audio, then try again."

export const hasUserActivation = () => navigator.userActivation?.hasBeenActive ?? true
