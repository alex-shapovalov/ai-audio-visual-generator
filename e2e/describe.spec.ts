import type { Page } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"

const describeLook = async (page: Page, prompt: string) => {
  await page.getByRole("textbox", { name: "Describe a look" }).fill(prompt)
  await page.getByRole("button", { name: "Generate look" }).click()
}

const aiAnswer = {
  look: {
    scene: "grid",
    colors: ["#f4ead5", "#ff9d2e", "#3a1d0b"],
    mediaId: null,
    mediaMix: 0.5,
    strobe: false,
    warp: 0.3,
    kaleido: false,
  },
  reason: "Warm amber suits a rolling tech house groove.",
  source: "openrouter",
}

test("describing a look without a key uses the local fallback and says why", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await describeLook(page, "filthy dubstep drop, acid green")

  await expect(page.getByTestId("look-source")).toHaveText("Local fallback")
  await expect(page.getByText("No OpenRouter key configured")).toBeVisible()
  await expect(deck.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Acid & Magenta" })).toHaveAttribute("aria-pressed", "true")
  await expect(deck.autoSwitch()).not.toBeChecked()
})

test("the AI director's answer is applied and its reason is shown", async ({ page }) => {
  await page.route("**/api/look", (route) => route.fulfill({ json: aiAnswer }))
  const deck = new DeckPage(page)
  await deck.open()

  await describeLook(page, "warm amber groove")

  await expect(page.getByTestId("look-source")).toHaveText("AI director")
  await expect(page.getByText(aiAnswer.reason)).toBeVisible()
  await expect(deck.sceneButton("Grid")).toHaveAttribute("aria-pressed", "true")
})
