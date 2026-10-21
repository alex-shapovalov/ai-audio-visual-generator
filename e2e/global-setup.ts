import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { DEMO_FILES } from "./demo-audio"

export default function globalSetup() {
  if (DEMO_FILES.every((file) => existsSync(file))) return
  execSync("pnpm demo:audio", { stdio: "inherit" })
}
