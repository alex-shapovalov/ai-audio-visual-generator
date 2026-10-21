import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"

test("the built-in demo drives the meters, the tempo and every section", async ({ page }) => {
  test.setTimeout(120_000)
  const deck = new DeckPage(page)
  await deck.open()
  await deck.runDemo()
  await expect(page.getByTestId("source-label")).toHaveText("Built-in 128 BPM loop")

  const sections = new Set<string>()
  const subLevels: number[] = []
  await expect
    .poll(
      async () => {
        const section = (await page.getByLabel("Section", { exact: true }).textContent()) ?? ""
        sections.add(section.trim().toLowerCase())
        const sub = await page.getByRole("meter", { name: "Sub" }).getAttribute("aria-valuenow")
        subLevels.push(Number(sub))
        return [...sections].sort()
      },
      { timeout: 90_000, intervals: [150] },
    )
    .toEqual(["breakdown", "build", "drop", "groove"])

  expect(Math.max(...subLevels)).toBeGreaterThan(0.6)
  expect(Math.min(...subLevels)).toBeLessThan(0.3)

  const tempo = (await page.getByLabel("Tempo", { exact: true }).textContent()) ?? ""
  const bpm = Number(tempo.replace(/\D/g, ""))
  expect(bpm).toBeGreaterThanOrEqual(125)
  expect(bpm).toBeLessThanOrEqual(131)
})

test("stopping the demo returns to idle", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.runDemo()
  await expect(page.getByTestId("source-label")).toBeVisible()

  await deck.stop()

  await expect(page.getByText("Not listening")).toBeVisible()
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeDisabled()
})
