import { DEMO } from "./demo-audio"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"

const RECOGNITION_TIMEOUT = 25_000

const enrolledDeck = async (page: ConstructorParameters<typeof DeckPage>[0]) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll([DEMO.techHouse, DEMO.dubstep, DEMO.trance], 3)
  await deck.openTab("Live")
  return deck
}

test("recognizes the playing track and applies its saved look on the next kick", async ({ page }) => {
  test.setTimeout(120_000)
  const deck = await enrolledDeck(page)

  await deck.playFile(DEMO.dubstep)

  await expect(page.getByText("Listening…")).toBeVisible()
  await expect(deck.matchTitle()).toHaveText("demo-dubstep-140", { timeout: RECOGNITION_TIMEOUT })
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: RECOGNITION_TIMEOUT })
  await expect(deck.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(deck.autoSwitch()).toBeChecked()

  await deck.openTab("Tracks")
  const row = deck.trackRows().filter({ hasText: "demo-dubstep-140" })
  await expect(row.getByTestId("live-score")).toBeVisible()
  await expect(deck.trackRows().getByTestId("live-score")).toHaveCount(1)
})

test("follows the music as the playing track changes", async ({ page }) => {
  test.setTimeout(180_000)
  const deck = await enrolledDeck(page)
  const sequence: [string, string, string][] = [
    [DEMO.techHouse, "demo-tech-house-126", "Grid"],
    [DEMO.dubstep, "demo-dubstep-140", "Rift"],
    [DEMO.trance, "demo-trance-136", "Portal"],
  ]

  for (const [file, title, scene] of sequence) {
    await deck.playFile(file)
    await expect(deck.matchTitle()).toHaveText(title, { timeout: RECOGNITION_TIMEOUT })
    await expect(deck.sceneButton(scene)).toHaveAttribute("aria-pressed", "true", { timeout: RECOGNITION_TIMEOUT })
  }
})

test("shows no stale match after stopping and starting another source", async ({ page }) => {
  test.setTimeout(120_000)
  const deck = await enrolledDeck(page)
  await deck.playFile(DEMO.dubstep)
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: RECOGNITION_TIMEOUT })

  await deck.stop()
  await expect(deck.matchTitle()).toHaveCount(0)
  await expect(page.getByText("Start an input to listen for your tracks.")).toBeVisible()

  await deck.playFile(DEMO.trance)
  await expect(page.getByText("Listening…")).toBeVisible()
  await expect(deck.matchTitle()).toHaveCount(0)
  await expect(deck.matchTitle()).toHaveText("demo-trance-136", { timeout: RECOGNITION_TIMEOUT })
})

test("manual control wins until auto cues are turned back on", async ({ page }) => {
  test.setTimeout(150_000)
  const deck = await enrolledDeck(page)
  await page.keyboard.press("4")
  await expect(deck.autoSwitch()).not.toBeChecked()

  await deck.playFile(DEMO.techHouse)
  await expect(deck.matchTitle()).toHaveText("demo-tech-house-126", { timeout: RECOGNITION_TIMEOUT })
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: RECOGNITION_TIMEOUT })
  await page.waitForTimeout(2500)
  await expect(deck.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")

  await page.keyboard.press("a")

  await expect(deck.autoSwitch()).toBeChecked()
  await expect(deck.sceneButton("Grid")).toHaveAttribute("aria-pressed", "true")
})

test("recognizes a track from a live input device", async ({ page }) => {
  test.setTimeout(120_000)
  const deck = await enrolledDeck(page)

  await page.getByRole("button", { name: "Connect input" }).click()
  await expect(page.getByRole("combobox", { name: "Audio input" })).toBeVisible()
  await page.getByRole("button", { name: "Listen", exact: true }).click()

  await expect(page.getByTestId("source-label")).toBeVisible()
  await expect(page.getByText("device", { exact: true })).toBeVisible()
  await expect(deck.matchTitle()).toHaveText("demo-dubstep-140", { timeout: RECOGNITION_TIMEOUT })
  await expect(deck.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
})
