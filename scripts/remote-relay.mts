import { createRelay, generateToken, networkUrls } from "../src/remote/relay.ts"

const port = Number(process.env.AFTERIMAGE_RELAY_PORT ?? 4618)
const nextPort = Number(process.env.AFTERIMAGE_NEXT_PORT ?? 4617)
const host = process.env.AFTERIMAGE_RELAY_HOST ?? "0.0.0.0"
const token = process.env.AFTERIMAGE_REMOTE_TOKEN ?? generateToken()

if (!Number.isInteger(port) || !Number.isInteger(nextPort)) {
  console.error("AFTERIMAGE_RELAY_PORT and AFTERIMAGE_NEXT_PORT must be whole numbers.")
  process.exit(1)
}

const relay = createRelay({ token, nextOrigin: `http://127.0.0.1:${nextPort}` })

relay.listen(port, host, () => {
  console.log(`Afterimage remote relay listening on ${host}:${port}, serving the app on port ${nextPort}.`)
  const links = networkUrls(port).map((url) => `${url}?token=${token}`)
  if (links.length === 0) {
    console.log("No network address was found. Connect to a network, then restart.")
    return
  }
  console.log("Open one of these on your phone or tablet, on the same network:")
  for (const link of links) console.log(`  ${link}`)
  console.log("The controls window shows the same link as a QR code. Anyone with the link can control the visuals.")
})
