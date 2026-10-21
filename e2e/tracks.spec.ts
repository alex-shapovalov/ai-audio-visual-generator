import { DEMO } from "./demo-audio"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"
import { silentWav } from "./generated-media"

const ALL_DEMOS = [DEMO.techHouse, DEMO.dubstep, DEMO.trance]

const rowFor = (deck: DeckPage, title: string) => deck.trackRows().filter({ hasText: title })

test("enrolls the demo tracks, picks a look for each and keeps them after a reload", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll(ALL_DEMOS, 3)

  await expect(deck.trackRows()).toHaveCount(3)
  const expectedScenes: [string, string][] = [
    ["demo-tech-house-126", "Grid"],
    ["demo-dubstep-140", "Rift"],
    ["demo-trance-136", "Portal"],
  ]
  for (const [title, scene] of expectedScenes) {
    const row = rowFor(deck, title)
    await expect(row).toContainText("0:48")
    const hashes = Number(/(\d+) hashes/.exec((await row.textContent()) ?? "")?.[1])
    expect(hashes).toBeGreaterThan(1000)
    expect(await deck.activeScene(row)).toBe(scene)
  }
  await expect(page.getByText(/Look chosen locally/).first()).toBeVisible()

  await deck.open()
  await deck.openTab("Tracks")
  await expect(deck.trackRows()).toHaveCount(3)
  expect(await deck.activeScene(rowFor(deck, "demo-dubstep-140"))).toBe("Rift")
})

test("refuses audio without enough distinctive content", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await deck.enroll([{ name: "silence.wav", mimeType: "audio/wav", buffer: silentWav(10) }], 1)

  await expect(page.getByText("Not enough distinctive audio to recognize this track")).toBeVisible()
  await expect(deck.trackRows()).toHaveCount(0)
})

test("reports a file that is not audio without adding a track", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()

  await deck.enroll([{ name: "notes.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("not audio at all") }], 1)

  await expect(page.getByRole("list", { name: "Enrollment progress" }).getByText("failed")).toBeVisible()
  await expect(deck.trackRows()).toHaveCount(0)
})

test("lets you edit a track's look and keeps the edit", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll([DEMO.dubstep], 1)
  const row = rowFor(deck, "demo-dubstep-140")

  await deck.sceneButton("Grid", row).click()
  await row.getByRole("button", { name: "Ember" }).click()
  await expect(deck.sceneButton("Grid", row)).toHaveAttribute("aria-pressed", "true")
  await expect(row.getByRole("button", { name: "Ember" })).toHaveAttribute("aria-pressed", "true")

  await deck.open()
  await deck.openTab("Tracks")
  const reloaded = rowFor(deck, "demo-dubstep-140")
  expect(await deck.activeScene(reloaded)).toBe("Grid")
  await expect(reloaded.getByRole("button", { name: "Ember" })).toHaveAttribute("aria-pressed", "true")
})

test("previews a track's look on the live visuals and pauses auto cues", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll([DEMO.dubstep], 1)

  await rowFor(deck, "demo-dubstep-140").getByRole("button", { name: "Preview" }).click()

  await deck.openTab("Live")
  await expect(deck.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(deck.autoSwitch()).not.toBeChecked()
})

test("suggests a look locally when no OpenRouter key is available", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll([DEMO.trance], 1)
  const row = rowFor(deck, "demo-trance-136")

  await row.getByRole("button", { name: "Suggest with AI" }).click()

  await expect(row.getByText("Local fallback")).toBeVisible()
  await expect(row.getByText("No OpenRouter key configured")).toBeVisible()
})

test("deletes a track", async ({ page }) => {
  const deck = new DeckPage(page)
  await deck.open()
  await deck.enroll([DEMO.techHouse, DEMO.trance], 2)

  await page.getByRole("button", { name: "Delete demo-trance-136" }).click()

  await expect(deck.trackRows()).toHaveCount(1)
  await deck.open()
  await deck.openTab("Tracks")
  await expect(deck.trackRows()).toHaveCount(1)
  await expect(rowFor(deck, "demo-tech-house-126")).toBeVisible()
})
