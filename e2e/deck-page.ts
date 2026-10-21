import { expect, type FileChooser, type Locator, type Page } from "@playwright/test"

export type TabName = "Live" | "Media" | "Tracks"
export type Upload = Parameters<FileChooser["setFiles"]>[0]

type MeterWindow = Window & { __meters?: Record<string, number[]> }

export class DeckPage {
  constructor(readonly page: Page) {}

  async recordMeter(label: string) {
    await this.page.evaluate((name) => {
      const meter = document.querySelector(`[role="meter"][aria-label="${name}"]`)
      if (!meter) throw new Error(`No meter named ${name}`)
      const read = () => Number(meter.getAttribute("aria-valuenow"))
      const values = [read()]
      new MutationObserver(() => values.push(read())).observe(meter, {
        attributes: true,
        attributeFilter: ["aria-valuenow"],
      })
      const meters = (window as MeterWindow).__meters ?? {}
      meters[name] = values
      ;(window as MeterWindow).__meters = meters
    }, label)
  }

  meterValues(label: string): Promise<number[]> {
    return this.page.evaluate((name) => [...((window as MeterWindow).__meters?.[name] ?? [])], label)
  }

  async open() {
    await this.page.goto("/")
    await expect(this.page.getByRole("button", { name: "Run built-in demo" })).toBeEnabled()
  }

  async openTab(name: TabName) {
    await this.page.getByRole("tab", { name }).click()
    await expect(this.page.getByRole("tabpanel", { name })).toBeVisible()
    await expect(this.page.getByRole("tabpanel")).toHaveCount(1)
  }

  async chooseFiles(buttonName: string, files: Upload) {
    const chooser = this.page.waitForEvent("filechooser")
    await this.page.getByRole("button", { name: buttonName }).click()
    await (await chooser).setFiles(files)
  }

  async playFile(file: Upload) {
    await this.chooseFiles("Play a file as input (test)", file)
  }

  async runDemo() {
    await this.page.getByRole("button", { name: "Run built-in demo" }).click()
  }

  async stop() {
    await this.page.getByRole("button", { name: "Stop", exact: true }).click()
  }

  async enroll(files: Upload, expectedJobs: number) {
    await this.openTab("Tracks")
    await this.chooseFiles("Choose tracks", files)
    const jobs = this.page.getByRole("list", { name: "Enrollment progress" }).getByRole("listitem")
    await expect(jobs).toHaveCount(expectedJobs)
    const unfinished = jobs.filter({ hasText: /queued|decoding|fingerprinting|choosing a look/i })
    await expect(unfinished).toHaveCount(0, { timeout: 60_000 })
  }

  trackRows() {
    return this.page.getByTestId("track-row")
  }

  sceneGroup(scope: Page | Locator = this.page) {
    return scope.getByRole("group", { name: "Scene" })
  }

  sceneButton(name: string, scope: Page | Locator = this.page) {
    return this.sceneGroup(scope).getByRole("button", { name, exact: true })
  }

  async activeScene(scope: Page | Locator = this.page) {
    return this.sceneGroup(scope).locator("[aria-pressed=true]").getAttribute("aria-label")
  }

  autoSwitch() {
    return this.page.getByRole("switch", { name: "Auto cues" })
  }

  strobeMaster() {
    return this.page.getByRole("switch", { name: "Strobe master" })
  }

  matchTitle() {
    return this.page.getByTestId("match-title")
  }

  async hidePanel() {
    await this.page.keyboard.press("h")
    await expect(this.page.getByRole("complementary", { name: "Controls" })).toBeHidden()
  }
}
