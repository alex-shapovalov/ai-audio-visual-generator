import path from "node:path"
import { defineConfig } from "@playwright/test"

const PORT = 4627
const ORIGIN = `http://127.0.0.1:${PORT}`
const FAKE_MICROPHONE = path.join(process.cwd(), "demo-audio", "demo-dubstep-140.wav")

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: ORIGIN,
    channel: "chromium",
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${FAKE_MICROPHONE}`,
      ],
    },
  },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT} -H 127.0.0.1`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { OPENROUTER_API_KEY: "" },
  },
})
