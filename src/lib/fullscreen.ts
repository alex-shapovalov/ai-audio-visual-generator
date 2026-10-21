export const enterFullscreen = () => {
  if (document.fullscreenElement) return
  document.documentElement.requestFullscreen().catch(() => undefined)
}

export const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
    return
  }
  enterFullscreen()
}
