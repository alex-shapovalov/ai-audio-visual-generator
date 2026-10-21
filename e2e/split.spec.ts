import type { BrowserContext, Page } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { DEMO } from "./demo-audio"
import { expect, test } from "./fixtures"
import {
  generateQuadrantPng,
  pixelsAt,
  startBrightnessSampler,
  stopBrightnessSampler,
  type Rgb,
} from "./generated-media"

const RECOGNITION_TIMEOUT = 25_000
const MIN_MEAN_BRIGHTNESS = 10
const SCENE_SETTLE_MS = 1000
const MEASURE_MS = 1000

const openControls = async (page: Page) => {
  await page.goto("/controls")
  await expect(page.getByRole("heading", { name: "Afterimage controls" })).toBeVisible()
  return new DeckPage(page)
}

const watchConsole = (page: Page, problems: string[]) => {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(`display ${message.type()}: ${message.text()}`)
  })
  page.on("pageerror", (error) => problems.push(`display pageerror: ${error.message}`))
}

const openUntouchedDisplay = async (context: BrowserContext, problems: string[]) => {
  const display = await context.newPage()
  watchConsole(display, problems)
  await display.goto("/display")
  return display
}

const openDisplay = async (context: BrowserContext, problems: string[]) => {
  const display = await openUntouchedDisplay(context, problems)
  await expect(display.getByLabel("Visuals")).toBeVisible()
  return display
}

const startDisplay = async (display: Page) => {
  const start = display.getByRole("button", { name: "Start display" })
  await start.click()
  await expect(start).toBeHidden()
}

const meanBrightness = async (display: Page) => {
  await startBrightnessSampler(display)
  await display.waitForTimeout(MEASURE_MS)
  const samples = await stopBrightnessSampler(display)
  return samples.reduce((total, sample) => total + sample.level, 0) / samples.length
}

const dominant = ([red, green, blue]: Rgb) => {
  const strongest = Math.max(red, green, blue)
  if (strongest < 80) return "dark"
  if (red > 150 && green > 150 && blue < 120) return "yellow"
  if (strongest === red) return "red"
  if (strongest === green) return "green"
  return "blue"
}

test("the controls know whether a display is open and connect when one opens", async ({
  page,
  context,
  consoleProblems,
}) => {
  await openControls(page)
  const demo = page.getByRole("button", { name: "Run built-in demo" })

  await expect(page.getByText("No display", { exact: true })).toBeVisible()
  await expect(page.getByText(/No display window is open/)).toBeVisible()
  await expect(demo).toBeDisabled()

  await openDisplay(context, consoleProblems)

  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()
  await expect(page.getByText(/No display window is open/)).toBeHidden()
  await expect(demo).toBeEnabled()
})

test("the controls can open the display window themselves", async ({ page, context }) => {
  await openControls(page)

  const opened = context.waitForEvent("page")
  await page.getByRole("button", { name: "Open display window" }).click()
  const display = await opened

  await expect(display).toHaveURL(/\/display$/)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()
})

test("the main page can split into a display window and controls in one click", async ({ page, context }) => {
  const deck = new DeckPage(page)
  await deck.open()

  const opened = context.waitForEvent("page")
  await page.getByRole("button", { name: "Two screens" }).click()
  const display = await opened

  await expect(display).toHaveURL(/\/display$/)
  await expect(page).toHaveURL(/\/controls$/)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()
})

test("the display is only the picture", async ({ page, context, consoleProblems }) => {
  await openControls(page)
  const display = await openDisplay(context, consoleProblems)

  await expect(display.getByRole("button", { name: "Start display" })).toBeVisible()
  await startDisplay(display)

  await expect(display.getByRole("button")).toHaveCount(0)
  await expect(display.getByRole("complementary")).toHaveCount(0)
  await expect(display.getByRole("tab")).toHaveCount(0)
})

test("the demo, scenes and keys on the controls drive what the display draws", async ({
  page,
  context,
  consoleProblems,
}) => {
  test.setTimeout(90_000)
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)

  await controls.runDemo()
  await expect(page.getByTestId("source-label")).toHaveText("Built-in 128 BPM loop")
  await expect(page.getByLabel("Tempo", { exact: true })).toHaveText(/^12[89] BPM$/)

  await controls.sceneButton("Rift").click()
  await expect(controls.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(controls.autoSwitch()).not.toBeChecked()
  await display.waitForTimeout(SCENE_SETTLE_MS)
  expect(await meanBrightness(display), "Rift").toBeGreaterThan(MIN_MEAN_BRIGHTNESS)

  await page.keyboard.press("6")
  await expect(controls.sceneButton("Bars")).toHaveAttribute("aria-pressed", "true")
  await display.waitForTimeout(SCENE_SETTLE_MS)
  expect(await meanBrightness(display), "Bars").toBeGreaterThan(MIN_MEAN_BRIGHTNESS)
})

test("keys pressed in the display window change the scene too", async ({ page, context, consoleProblems }) => {
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)

  await page.keyboard.press("7")
  await expect(controls.sceneButton("Aurora")).toHaveAttribute("aria-pressed", "true")

  await display.keyboard.press("8")
  await expect(controls.sceneButton("Warp")).toHaveAttribute("aria-pressed", "true")
  await expect(controls.autoSwitch()).not.toBeChecked()

  await display.keyboard.press("a")
  await expect(controls.autoSwitch()).toBeChecked()
})

test("tracks enrolled in the controls are recognized by the display, before and after it opens", async ({
  page,
  context,
  consoleProblems,
}) => {
  test.setTimeout(180_000)
  const controls = await openControls(page)
  await controls.enroll([DEMO.dubstep], 1)

  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)
  await controls.enroll([DEMO.trance], 2)
  await controls.openTab("Live")

  await controls.playFile(DEMO.dubstep)
  await expect(controls.matchTitle()).toHaveText("demo-dubstep-140", { timeout: RECOGNITION_TIMEOUT })
  await expect(page.getByText("Confirmed")).toBeVisible({ timeout: RECOGNITION_TIMEOUT })
  await expect(controls.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true", { timeout: RECOGNITION_TIMEOUT })

  await controls.playFile(DEMO.trance)
  await expect(controls.matchTitle()).toHaveText("demo-trance-136", { timeout: RECOGNITION_TIMEOUT })
  await expect(controls.sceneButton("Portal")).toHaveAttribute("aria-pressed", "true", {
    timeout: RECOGNITION_TIMEOUT,
  })
})

test("media added in the controls is drawn by the display", async ({ page, context, consoleProblems }) => {
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)

  await controls.openTab("Media")
  const png = await generateQuadrantPng(page)
  await controls.chooseFiles("Choose files", [{ name: "quadrants.png", mimeType: "image/png", buffer: png }])
  await page.getByRole("button", { name: "Use quadrants.png in the current look" }).click()
  await page.keyboard.press("5")

  const { width, height } = display.viewportSize() ?? { width: 1280, height: 800 }
  const spots = [
    { x: Math.round(width * 0.25), y: Math.round(height * 0.25) },
    { x: Math.round(width * 0.75), y: Math.round(height * 0.25) },
    { x: Math.round(width * 0.25), y: Math.round(height * 0.75) },
    { x: Math.round(width * 0.75), y: Math.round(height * 0.75) },
  ]
  await expect
    .poll(async () => (await pixelsAt(display, spots)).map(dominant), { timeout: 15_000, intervals: [300] })
    .toEqual(["red", "green", "blue", "yellow"])
})

test("the display needs one click before it can use audio, then listens to the chosen input", async ({
  page,
  context,
  consoleProblems,
}) => {
  test.setTimeout(90_000)
  const controls = await openControls(page)
  const display = await openUntouchedDisplay(context, consoleProblems)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Connect input" }).click()
  await expect(page.getByRole("combobox", { name: "Audio input" })).toBeVisible()
  await page.getByRole("button", { name: "Listen", exact: true }).click()

  await expect(page.getByRole("alert").filter({ hasText: /then try again/ })).toBeVisible()
  await expect(page.getByText(/Click the display window once so it is allowed/)).toBeVisible()
  await expect(page.getByTestId("source-label")).toBeHidden()

  await startDisplay(display)
  await expect(page.getByText(/Click the display window once so it is allowed/)).toBeHidden()
  await controls.recordMeter("Sub")
  await page.getByRole("button", { name: "Listen", exact: true }).click()

  await expect(page.getByTestId("source-label")).toBeVisible()
  await expect(page.getByText("device", { exact: true })).toBeVisible()
  await expect.poll(async () => Math.max(...(await controls.meterValues("Sub")))).toBeGreaterThan(0.3)
})

test("closing the display puts the controls back to waiting", async ({ page, context, consoleProblems }) => {
  await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()

  await display.close()

  await expect(page.getByText("No display", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Run built-in demo" })).toBeDisabled()
})

test("the strobe master is off again after the display reloads", async ({ page, context, consoleProblems }) => {
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()

  await controls.strobeMaster().click()
  await expect(controls.strobeMaster()).toBeChecked()

  await display.reload()

  await expect(controls.strobeMaster()).not.toBeChecked()
})
