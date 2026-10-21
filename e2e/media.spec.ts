import type { Page } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"
import { generateQuadrantPng, generateWebm, pixelsAt, type Rgb } from "./generated-media"

const mediaLibrary = (page: Page) => page.getByRole("list", { name: "Media library" })

const uploadImage = async (deck: DeckPage) => {
  await deck.openTab("Media")
  const png = await generateQuadrantPng(deck.page)
  await deck.chooseFiles("Choose files", [{ name: "quadrants.png", mimeType: "image/png", buffer: png }])
  await expect(mediaLibrary(deck.page).getByRole("listitem")).toHaveCount(1)
}

const dominant = ([red, green, blue]: Rgb) => {
  const strongest = Math.max(red, green, blue)
  if (strongest < 80) return "dark"
  if (red > 150 && green > 150 && blue < 120) return "yellow"
  if (strongest === red) return "red"
  if (strongest === green) return "green"
  return "blue"
}

test("adds an image and a video, keeps them after a reload and applies them to the look", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Media")
  const png = await generateQuadrantPng(page)
  const webm = await generateWebm(page)

  await deck.chooseFiles("Choose files", [
    { name: "quadrants.png", mimeType: "image/png", buffer: png },
    { name: "loop.webm", mimeType: "video/webm", buffer: webm },
  ])
  await expect(mediaLibrary(page).getByRole("listitem")).toHaveCount(2)

  await deck.open()
  await deck.openTab("Media")
  await expect(mediaLibrary(page).getByRole("listitem")).toHaveCount(2)

  const useImage = page.getByRole("button", { name: "Use quadrants.png in the current look" })
  await useImage.click()
  await expect(useImage).toHaveAttribute("aria-pressed", "true")
  await deck.openTab("Live")
  await expect(page.getByRole("combobox", { name: "Media layer" })).toContainText("quadrants.png")
})

test("accepts files dropped onto the drop zone", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Media")
  const png = await generateQuadrantPng(page)

  const dataTransfer = await page.evaluateHandle(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }))
    return transfer
  }, png.toString("base64"))
  await page.getByTestId("media-dropzone").dispatchEvent("drop", { dataTransfer })

  await expect(page.getByRole("button", { name: "Use dropped.png in the current look" })).toBeVisible()
})

test("shows the image upright and filling the frame like cover", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await uploadImage(deck)
  await page.getByRole("button", { name: "Use quadrants.png in the current look" }).click()
  await page.keyboard.press("5")
  await deck.hidePanel()

  const { width, height } = page.viewportSize() ?? { width: 1280, height: 800 }
  const spots = [
    { x: Math.round(width * 0.25), y: Math.round(height * 0.25) },
    { x: Math.round(width * 0.75), y: Math.round(height * 0.25) },
    { x: Math.round(width * 0.25), y: Math.round(height * 0.75) },
    { x: Math.round(width * 0.75), y: Math.round(height * 0.75) },
  ]
  await expect
    .poll(async () => (await pixelsAt(page, spots)).map(dominant), { timeout: 15_000, intervals: [300] })
    .toEqual(["red", "green", "blue", "yellow"])
})

test("plays a video loop through the media scene", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Media")
  const webm = await generateWebm(page)
  await deck.chooseFiles("Choose files", [{ name: "loop.webm", mimeType: "video/webm", buffer: webm }])
  await page.getByRole("button", { name: "Use loop.webm in the current look" }).click()
  await page.keyboard.press("5")
  await deck.hidePanel()

  const { width, height } = page.viewportSize() ?? { width: 1280, height: 800 }
  const centre = [{ x: Math.round(width / 2), y: Math.round(height / 2) }]
  const seen: string[] = []
  await expect
    .poll(
      async () => {
        const [pixel] = await pixelsAt(page, centre)
        seen.push(pixel.join(","))
        return Math.max(...pixel) > 80 && new Set(seen).size > 2
      },
      { timeout: 15_000, intervals: [200] },
    )
    .toBe(true)
})

test("renames and deletes media, and the change survives a reload", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await uploadImage(deck)

  await page.getByRole("button", { name: "Rename quadrants.png" }).click()
  const field = page.getByRole("textbox", { name: "New name for quadrants.png" })
  await field.fill("backdrop.png")
  await field.press("Enter")
  await expect(page.getByRole("button", { name: "Use backdrop.png in the current look" })).toBeVisible()

  await deck.open()
  await deck.openTab("Media")
  await expect(page.getByRole("button", { name: "Use backdrop.png in the current look" })).toBeVisible()

  await page.getByRole("button", { name: "Delete backdrop.png" }).click()
  await expect(mediaLibrary(page)).toHaveCount(0)
  await deck.open()
  await deck.openTab("Media")
  await expect(page.getByText("No media yet.")).toBeVisible()
})

test("falls back to the portal when the media in use is deleted", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await uploadImage(deck)
  await page.getByRole("button", { name: "Use quadrants.png in the current look" }).click()
  await page.keyboard.press("5")
  await deck.openTab("Live")
  await expect(deck.sceneButton("Media")).toHaveAttribute("aria-pressed", "true")

  await deck.openTab("Media")
  await page.getByRole("button", { name: "Delete quadrants.png" }).click()

  await deck.openTab("Live")
  await expect(deck.sceneButton("Portal")).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("combobox", { name: "Media layer" })).toContainText("No media")
})

test("explains which files cannot be added", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Media")

  await deck.chooseFiles("Choose files", [
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not media") },
  ])

  await expect(page.getByText("notes.txt: Only images and videos can be added")).toBeVisible()
  await expect(page.getByText("No media yet.")).toBeVisible()
})
