import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

const nextPort = process.env.AFTERIMAGE_NEXT_PORT ?? "4617"
const relayPort = process.env.AFTERIMAGE_RELAY_PORT ?? "4618"

if (!existsSync(".next/BUILD_ID")) {
  console.error("There is no production build yet. Run `pnpm build` first.")
  process.exit(1)
}

const env = { ...process.env, AFTERIMAGE_NEXT_PORT: nextPort, AFTERIMAGE_RELAY_PORT: relayPort }

const children = [
  spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", nextPort, "-H", "127.0.0.1"], {
    env,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/remote-relay.mts"], {
    env,
    stdio: "inherit",
  }),
]

let stopping = false

const stop = (code) => {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill("SIGTERM")
  process.exitCode = code
}

process.on("SIGINT", () => stop(0))
process.on("SIGTERM", () => stop(0))
for (const child of children) child.on("exit", (code) => stop(code ?? 1))
