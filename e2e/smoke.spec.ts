import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"

test("starts cleanly with the visuals running and the controls visible", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await expect(page.getByRole("heading", { name: "The visuals could not start" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Afterimage" })).toBeVisible()
  await expect(page.getByLabel("Visuals")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Live" })).toHaveAttribute("aria-selected", "true")
})

test("never starts audio before the user asks for it", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await expect(page.getByText("Not listening")).toBeVisible()
  await expect(page.getByText("Start an input to listen for your tracks.")).toBeVisible()
})
