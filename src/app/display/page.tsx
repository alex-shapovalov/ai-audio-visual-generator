import type { Metadata } from "next"
import { DisplayPage } from "@/components/deck/display-page"

export const metadata: Metadata = {
  title: "Afterimage display",
}

export default function Display() {
  return <DisplayPage />
}
