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

test("the key saved in settings is sent with look requests and the AI answer is applied", async ({ page }) => {
  const sentKeys: (string | undefined)[] = []
  await page.route("**/api/look", async (route) => {
    sentKeys.push(route.request().headers()["x-openrouter-key"])
    await route.fulfill({ json: aiAnswer })
  })
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Settings")
  await page.getByLabel("API key").fill("test-key-not-real")

  await deck.openTab("Live")
  await describeLook(page, "warm amber groove")

  await expect(page.getByTestId("look-source")).toHaveText("AI director")
  await expect(page.getByText(aiAnswer.reason)).toBeVisible()
  await expect(deck.sceneButton("Grid")).toHaveAttribute("aria-pressed", "true")
  expect(sentKeys).toEqual(["test-key-not-real"])
})

test("the saved key survives a reload and can be cleared", async ({ page }) => {
  const sentKeys: (string | undefined)[] = []
  await page.route("**/api/look", async (route) => {
    sentKeys.push(route.request().headers()["x-openrouter-key"])
    await route.fulfill({ json: aiAnswer })
  })
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Settings")
  await page.getByLabel("API key").fill("test-key-not-real")

  await deck.open()
  await deck.openTab("Settings")
  await expect(page.getByLabel("API key")).toHaveValue("test-key-not-real")

  await page.getByRole("button", { name: "Clear key" }).click()
  await expect(page.getByLabel("API key")).toHaveValue("")
  await deck.openTab("Live")
  await describeLook(page, "anything")
  await expect(page.getByTestId("look-source")).toBeVisible()
  expect(sentKeys).toEqual([undefined])
})

test("shows the model as read-only and says where to change it", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.openTab("Settings")

  const model = page.getByRole("textbox", { name: "Model" })
  await expect(model).toHaveValue("openai/gpt-4o-mini")
  await expect(model).toHaveAttribute("readonly", "")
  await expect(page.getByText(/OPENROUTER_MODEL/)).toBeVisible()
})
