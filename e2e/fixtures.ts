import { expect, test as base } from "@playwright/test"

export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          problems.push(`${message.type()}: ${message.text()}`)
        }
      })
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`))
      await use(problems)
      expect(problems, "console errors and warnings").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
