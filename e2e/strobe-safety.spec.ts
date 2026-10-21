import type { Page } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"
import {
  pulseTrainWav,
  startBrightnessSampler,
  stopBrightnessSampler,
  type BrightnessSample,
} from "./generated-media"

const MIN_FLASH_GAP_MS = 120
const MEASURED_SECONDS = 8
const FLASH_CAP_PER_SECOND = 4.5

const countFlashes = (samples: BrightnessSample[]) => {
  const levels = samples.map((sample) => sample.level)
  const low = Math.min(...levels)
  const high = Math.max(...levels)
  const threshold = low + (high - low) * 0.5
  let flashes = 0
  let lastFlash = Number.NEGATIVE_INFINITY
  samples.forEach((sample, index) => {
    const rising = sample.level >= threshold && (samples[index - 1]?.level ?? 0) < threshold
    if (rising && sample.at - lastFlash >= MIN_FLASH_GAP_MS) {
      flashes++
      lastFlash = sample.at
    }
  })
  return { flashes, swing: high - low }
}

const measureStrobe = async (page: Page, pulsePeriodMs: number) => {
  const deck = new DeckPage(page)
  await deck.open()
  await page.keyboard.press("3")
  await page.getByRole("switch", { name: "Strobe on this look" }).click()
  await deck.strobeMaster().click()
  await deck.playFile({
    name: "pulses.wav",
    mimeType: "audio/wav",
    buffer: pulseTrainWav(30, pulsePeriodMs),
  })
  await expect(page.getByTestId("source-label")).toHaveText("pulses.wav")
  await deck.hidePanel()
  await page.waitForTimeout(1500)

  await startBrightnessSampler(page)
  await page.waitForTimeout(MEASURED_SECONDS * 1000)
  const samples = await stopBrightnessSampler(page)
  const { flashes, swing } = countFlashes(samples)

  expect(samples.length, "the page kept rendering").toBeGreaterThan(MEASURED_SECONDS * 30)
  expect(swing, "the picture must visibly pulse for the measurement to mean anything").toBeGreaterThan(8)
  return flashes / MEASURED_SECONDS
}

test("strobe flashes stay under about four per second for pulses 50% faster than the cap", async ({
  page,
}) => {
  test.setTimeout(120_000)

  const perSecond = await measureStrobe(page, 160)

  expect(perSecond).toBeGreaterThan(1)
  expect(perSecond).toBeLessThanOrEqual(FLASH_CAP_PER_SECOND)
})

test("strobe still follows a normal groove below the cap almost beat for beat", async ({ page }) => {
  test.setTimeout(120_000)

  const perSecond = await measureStrobe(page, 260)

  expect(perSecond).toBeGreaterThanOrEqual(3.3)
  expect(perSecond).toBeLessThanOrEqual(FLASH_CAP_PER_SECOND)
})
