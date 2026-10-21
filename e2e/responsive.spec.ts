import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test("the controls become a bottom sheet over a full-screen canvas without sideways scrolling", async ({
    page,
  }) => {
    const deck = new DeckPage(page)
    await deck.open()

    const panel = await page.getByRole("complementary", { name: "Controls" }).boundingBox()
    const canvas = await page.getByLabel("Visuals").boundingBox()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

    expect(panel?.width).toBeCloseTo(390, 0)
    expect(panel?.y).toBeGreaterThan(844 * 0.3)
    expect((panel?.y ?? 0) + (panel?.height ?? 0)).toBeCloseTo(844, 0)
    expect(canvas).toMatchObject({ x: 0, y: 0, width: 390, height: 844 })
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("every tab is reachable and the demo can be started by touch", async ({ page }) => {
    const deck = new DeckPage(page)
    await deck.open()

    await page.getByRole("button", { name: "Run built-in demo" }).tap()
    await expect(page.getByTestId("source-label")).toHaveText("Built-in 128 BPM loop")

    for (const tab of ["Media", "Tracks", "Live"] as const) {
      await page.getByRole("tab", { name: tab }).tap()
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true")
    }
  })
})

test("the controls sit on the right on a desktop screen", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  const panel = await page.getByRole("complementary", { name: "Controls" }).boundingBox()

  expect(panel?.x).toBeGreaterThan(1280 / 2)
  expect(panel?.height).toBeCloseTo(800, 0)
})
