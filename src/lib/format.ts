export const formatDuration = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return `${minutes}:${rest}`
}

export const titleFromFileName = (name: string) => {
  const stem = name.replace(/\.[^./\\]+$/, "").trim()
  return stem === "" ? name : stem
}
