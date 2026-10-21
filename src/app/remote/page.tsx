import type { Metadata } from "next"
import { RemotePage } from "@/components/deck/remote-page"

export const metadata: Metadata = {
  title: "Afterimage remote",
}

export default function Remote() {
  return <RemotePage />
}
