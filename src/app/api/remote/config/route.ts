import { connection } from "next/server"

export async function GET() {
  await connection()
  const port = Number(process.env.AFTERIMAGE_RELAY_PORT)
  return Response.json({ relayPort: Number.isInteger(port) && port > 0 ? port : null })
}
