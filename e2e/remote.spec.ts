import os from "node:os"
import type { Browser, BrowserContext } from "@playwright/test"
import { DeckPage } from "./deck-page"
import { expect, test } from "./fixtures"
import { openControls, openDisplay, startDisplay, watchConsole } from "./windows"

const RELAY_PORT = 4637
const RELAY = `http://127.0.0.1:${RELAY_PORT}`

const LAN = Object.values(os.networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .find((entry) => entry.family === "IPv4" && !entry.internal)?.address

test.skip(LAN === undefined, "This machine has no network address to pair a phone with")

const PHONE_RELAY = `http://${LAN}:${RELAY_PORT}`

const pairingToken = async (context: BrowserContext) => {
  const response = await context.request.get(`${RELAY}/info`)
  return ((await response.json()) as { token: string }).token
}

const pairPhone = async (browser: Browser, context: BrowserContext, problems: string[]) => {
  const token = await pairingToken(context)
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const phone = await phoneContext.newPage()
  watchConsole(phone, problems, "phone")
  await phone.goto(`${PHONE_RELAY}/?token=${token}`)
  await expect(phone.getByRole("heading", { name: "Afterimage remote" })).toBeVisible()
  return { phone, phoneContext }
}

test("the controls window shows a QR code and a pairing link when the relay is on", async ({ page }) => {
  await openControls(page)
  await page.getByText("Control from a phone or tablet").click()

  await expect(page.getByTestId("remote-link")).toHaveText(
    new RegExp(`^http://\\d+\\.\\d+\\.\\d+\\.\\d+:${RELAY_PORT}/\\?token=[0-9a-f]{32}$`),
  )
  await expect(page.getByRole("img", { name: "QR code that pairs a phone" })).toBeVisible()
})

test("a paired phone drives the display and mirrors what it does", async ({
  page,
  context,
  browser,
  consoleProblems,
}) => {
  test.setTimeout(90_000)
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()

  const { phone, phoneContext } = await pairPhone(browser, context, consoleProblems)
  const remote = new DeckPage(phone)
  await expect(phone.getByText("Display connected", { exact: true })).toBeVisible()

  await remote.sceneButton("Rift").click()
  await expect(remote.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(controls.sceneButton("Rift")).toHaveAttribute("aria-pressed", "true")
  await expect(controls.autoSwitch()).not.toBeChecked()

  await phone.getByRole("button", { name: "Sunset", exact: true }).click()
  await expect(phone.getByRole("button", { name: "Sunset", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Sunset", exact: true })).toHaveAttribute("aria-pressed", "true")

  await remote.autoSwitch().click()
  await expect(controls.autoSwitch()).toBeChecked()

  await phoneContext.close()
})

test("a phone can switch the strobe master off but not on", async ({ page, context, browser, consoleProblems }) => {
  const controls = await openControls(page)
  const display = await openDisplay(context, consoleProblems)
  await startDisplay(display)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()
  const { phone, phoneContext } = await pairPhone(browser, context, consoleProblems)
  const master = phone.getByRole("switch", { name: "Strobe master" })

  await expect(phone.getByText("Display connected", { exact: true })).toBeVisible()
  await expect(master).toBeDisabled()
  await expect(master).not.toBeChecked()

  await controls.strobeMaster().click()
  await expect(master).toBeChecked()
  await expect(master).toBeEnabled()

  await master.click()
  await expect(master).not.toBeChecked()
  await expect(controls.strobeMaster()).not.toBeChecked()
  await expect(master).toBeDisabled()

  await phoneContext.close()
})

test("a paired phone is still refused the commands a remote may not send", async ({
  context,
  browser,
  consoleProblems,
}) => {
  const { phoneContext } = await pairPhone(browser, context, consoleProblems)
  const send = (data: unknown) => phoneContext.request.post(`${PHONE_RELAY}/command`, { data })

  expect((await send({ type: "strobe-master", enabled: true })).status()).toBe(400)
  expect((await send({ type: "listen", deviceId: "x", label: "y" })).status()).toBe(400)
  expect((await send({ type: "play-file", file: "x" })).status()).toBe(400)
  expect((await send({ type: "stop" })).status()).toBe(400)
  expect((await send({ type: "scene", scene: "lasers" })).status()).toBe(204)

  await phoneContext.close()
})

test("a device on the network that has not paired can neither read nor control anything", async ({ playwright }) => {
  const stranger = await playwright.request.newContext()

  expect((await stranger.get(`${PHONE_RELAY}/info`)).status()).toBe(401)
  expect((await stranger.get(`${PHONE_RELAY}/events`)).status()).toBe(401)
  expect((await stranger.get(`${PHONE_RELAY}/events?role=display`)).status()).toBe(401)
  expect((await stranger.get(`${PHONE_RELAY}/remote`)).status()).toBe(401)
  expect((await stranger.get(`${PHONE_RELAY}/?token=${"0".repeat(32)}`, { maxRedirects: 0 })).status()).toBe(401)
  expect((await stranger.post(`${PHONE_RELAY}/command`, { data: { type: "scene", scene: "rift" } })).status()).toBe(401)
  expect((await stranger.post(`${PHONE_RELAY}/snapshot`, { data: { look: {} } })).status()).toBe(401)
  expect((await stranger.get(`${PHONE_RELAY}/api/look`)).status()).toBe(404)

  await stranger.dispose()
})

test("a phone waits for the display, wakes up when it opens and waits again when it closes", async ({
  context,
  browser,
  consoleProblems,
}) => {
  const { phone, phoneContext } = await pairPhone(browser, context, consoleProblems)

  await expect(phone.getByText("No display", { exact: true })).toBeVisible()
  await expect(phone.getByText(/Waiting for the display window/)).toBeVisible()

  const display = await openDisplay(context, consoleProblems)
  await expect(phone.getByText("Display connected", { exact: true })).toBeVisible()

  await display.close()
  await expect(phone.getByText("No display", { exact: true })).toBeVisible()

  await phoneContext.close()
})

test("the display and the local controls work when no relay is configured", async ({
  page,
  context,
  consoleProblems,
}) => {
  const relayRequests: string[] = []
  await context.route("**/api/remote/config", (route) => route.fulfill({ json: { relayPort: null } }))
  context.on("request", (request) => {
    if (request.url().startsWith(RELAY)) relayRequests.push(request.url())
  })

  await openControls(page)
  await openDisplay(context, consoleProblems)
  await expect(page.getByText("Display connected", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Run built-in demo" }).click()
  await expect(page.getByTestId("source-label")).toHaveText("Built-in 128 BPM loop")

  expect(relayRequests).toEqual([])
})
