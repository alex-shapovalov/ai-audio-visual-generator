import type { BrowserContext, Page } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { expect } from "./fixtures"

export const openControls = async (page: Page) => {
  await page.goto("/controls")
  await expect(page.getByRole("heading", { name: "Afterimage controls" })).toBeVisible()
  return new DeckPage(page)
}

export const watchConsole = (page: Page, problems: string[], label: string) => {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(`${label} ${message.type()}: ${message.text()}`)
  })
  page.on("pageerror", (error) => problems.push(`${label} pageerror: ${error.message}`))
}

export const openUntouchedDisplay = async (context: BrowserContext, problems: string[]) => {
  const display = await context.newPage()
  watchConsole(display, problems, "display")
  await display.goto("/display")
  return display
}

export const openDisplay = async (context: BrowserContext, problems: string[]) => {
  const display = await openUntouchedDisplay(context, problems)
  await expect(display.getByLabel("Visuals")).toBeVisible()
  return display
}

export const startDisplay = async (display: Page) => {
  const start = display.getByRole("button", { name: "Start display" })
  await start.click()
  await expect(start).toBeHidden()
}
