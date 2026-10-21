import type { Page } from "@playwright/test"

export type Rgb = [number, number, number]

export const generateQuadrantPng = async (page: Page): Promise<Buffer> => {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 200
    canvas.height = 100
    const context = canvas.getContext("2d")
    if (!context) throw new Error("2d canvas is unavailable")
    const rows = [
      ["#ff0000", "#00ff00"],
      ["#0000ff", "#ffff00"],
    ]
    rows.forEach((row, y) =>
      row.forEach((color, x) => {
        context.fillStyle = color
        context.fillRect(x * 100, y * 50, 100, 50)
      }),
    )
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("PNG encoding failed")
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return btoa(bytes.reduce((text, byte) => text + String.fromCharCode(byte), ""))
  })
  return Buffer.from(base64, "base64")
}

export const generateWebm = async (page: Page): Promise<Buffer> => {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 160
    canvas.height = 90
    const context = canvas.getContext("2d")
    if (!context) throw new Error("2d canvas is unavailable")
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm;codecs=vp8" })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.start()
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const paint = () => {
        const elapsed = performance.now() - started
        context.fillStyle = `hsl(${elapsed / 4}, 90%, 50%)`
        context.fillRect(0, 0, 160, 90)
        if (elapsed > 1200) resolve()
        else requestAnimationFrame(paint)
      }
      paint()
    })
    recorder.stop()
    await stopped
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    return btoa(bytes.reduce((text, byte) => text + String.fromCharCode(byte), ""))
  })
  return Buffer.from(base64, "base64")
}

export const silentWav = (seconds: number, sampleRate = 11025): Buffer => {
  const samples = Math.floor(seconds * sampleRate)
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write("RIFF", 0)
  bytes.writeUInt32LE(36 + samples * 2, 4)
  bytes.write("WAVEfmt ", 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write("data", 36)
  bytes.writeUInt32LE(samples * 2, 40)
  return bytes
}

export const pixelsAt = async (page: Page, points: { x: number; y: number }[]): Promise<Rgb[]> => {
  const screenshot = await page.screenshot({ type: "png" })
  return page.evaluate(
    async ({ base64, spots }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) throw new Error("2d canvas is unavailable")
      context.drawImage(image, 0, 0)
      return spots.map(({ x, y }) => {
        const [red, green, blue] = context.getImageData(x, y, 1, 1).data
        return [red, green, blue] as Rgb
      })
    },
    { base64: screenshot.toString("base64"), spots: points },
  )
}
