import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"
import { startBrightnessSampler, stopBrightnessSampler } from "./generated-media"

const DRAWING_SCENES: [string, string][] = [
  ["1", "Portal"],
  ["2", "Grid"],
  ["3", "Strobe"],
  ["4", "Rift"],
  ["6", "Bars"],
  ["7", "Aurora"],
  ["8", "Warp"],
  ["9", "Lasers"],
  ["0", "Bloom"],
]
const PALETTE_NAMES = [
  "Bone & Amber",
  "Acid & Magenta",
  "Cyan & Violet",
  "Ember",
  "Monochrome",
  "Sunset",
  "Glacier",
  "Toxic",
  "Royal",
  "Crimson",
  "Synthwave",
  "Deep Sea",
]
const SCENE_SETTLE_MS = 1000
const MEASURE_MS = 1000
const MIN_MEAN_BRIGHTNESS = 10

test("keys 1 to 5 select the scenes and pause auto cues", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await expect(deck.autoSwitch()).toBeChecked()

  const keys: [string, string][] = [
    ["2", "Grid"],
    ["3", "Strobe"],
    ["4", "Rift"],
    ["5", "Media"],
    ["1", "Portal"],
  ]
  for (const [key, scene] of keys) {
    await page.keyboard.press(key)
    await expect(deck.sceneButton(scene)).toHaveAttribute("aria-pressed", "true")
  }

  await expect(deck.autoSwitch()).not.toBeChecked()
  await expect(page.getByText("Manual: cues paused")).toBeVisible()
})

test("keys 6 to 9 and 0 select the newer scenes", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  for (const [key, scene] of [
    ["6", "Bars"],
    ["7", "Aurora"],
    ["8", "Warp"],
    ["9", "Lasers"],
    ["0", "Bloom"],
  ]) {
    await page.keyboard.press(key)
    await expect(deck.sceneButton(scene)).toHaveAttribute("aria-pressed", "true")
  }
  await expect(deck.autoSwitch()).not.toBeChecked()
})

test("every scene draws visible output on the GPU", async ({ page }) => {
  test.setTimeout(120_000)
  const deck = new DeckPage(page)
  await deck.open()
  await deck.runDemo()

  for (const [key, scene] of DRAWING_SCENES) {
    await page.keyboard.press(key)
    await expect(deck.sceneButton(scene)).toHaveAttribute("aria-pressed", "true")
    await page.waitForTimeout(SCENE_SETTLE_MS)
    await startBrightnessSampler(page)
    await page.waitForTimeout(MEASURE_MS)
    const samples = await stopBrightnessSampler(page)
    const mean = samples.reduce((total, sample) => total + sample.level, 0) / samples.length
    expect(mean, scene).toBeGreaterThan(MIN_MEAN_BRIGHTNESS)
  }
})

test("every palette can be picked", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  const swatches = page.getByRole("group", { name: "Palette" }).getByRole("button")
  await expect(swatches).toHaveCount(PALETTE_NAMES.length)
  for (const name of PALETTE_NAMES) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true")
  }
  await expect(deck.autoSwitch()).not.toBeChecked()
})

test("clicking a scene also takes manual control", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await deck.sceneButton("Grid").click()

  await expect(deck.sceneButton("Grid")).toHaveAttribute("aria-pressed", "true")
  await expect(deck.autoSwitch()).not.toBeChecked()
})

test("the A key and the resume button bring auto cues back", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await page.keyboard.press("4")
  await expect(deck.autoSwitch()).not.toBeChecked()

  await page.keyboard.press("a")
  await expect(deck.autoSwitch()).toBeChecked()
  await expect(page.getByText("Manual: cues paused")).toBeHidden()

  await page.keyboard.press("a")
  await expect(deck.autoSwitch()).not.toBeChecked()
  await page.getByRole("button", { name: "Resume auto cues" }).click()
  await expect(deck.autoSwitch()).toBeChecked()
})

test("shortcuts are ignored while typing", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  const box = page.getByRole("textbox", { name: "Describe a look" })

  await box.click()
  await page.keyboard.type("1245 a h f")

  await expect(box).toHaveValue("1245 a h f")
  await expect(deck.sceneButton("Portal")).toHaveAttribute("aria-pressed", "true")
  await expect(deck.autoSwitch()).toBeChecked()
  await expect(page.getByRole("complementary", { name: "Controls" })).toBeVisible()
})

test("H hides the panel for projector mode and the pointer brings the button back", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await deck.hidePanel()
  await page.mouse.move(300, 300)
  await page.mouse.move(320, 320)
  const show = page.getByRole("button", { name: "Show controls (H)" })
  await expect(show).toHaveCSS("opacity", "1")
  await show.click()

  await expect(page.getByRole("complementary", { name: "Controls" })).toBeVisible()
})

test("the strobe master is off by default and explains the risk", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await expect(deck.strobeMaster()).not.toBeChecked()
  await expect(page.getByText(/photosensitiv/i)).toBeVisible()
  await expect(page.getByRole("switch", { name: "Strobe on this look" })).not.toBeChecked()

  await deck.strobeMaster().click()
  await expect(deck.strobeMaster()).toBeChecked()
})

test("the strobe master does not persist across reloads", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.strobeMaster().click()
  await expect(deck.strobeMaster()).toBeChecked()

  await deck.open()

  await expect(deck.strobeMaster()).not.toBeChecked()
})
