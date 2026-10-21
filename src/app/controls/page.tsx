import type { Metadata } from "next"
import { ControlsPage } from "@/components/deck/controls-page"

export const metadata: Metadata = {
  title: "Afterimage controls",
}

export default function Controls() {
  return <ControlsPage />
}
