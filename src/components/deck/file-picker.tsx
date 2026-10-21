"use client"

import { useRef, type ComponentProps, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type FilePickerProps = {
  children: ReactNode
  accept: string
  label: string
  multiple?: boolean
  disabled?: boolean
  variant?: ComponentProps<typeof Button>["variant"]
  onFiles: (files: File[]) => void
}

export function FilePicker({
  children,
  accept,
  label,
  multiple = false,
  disabled = false,
  variant = "outline",
  onFiles,
}: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <Button type="button" variant={variant} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        aria-label={label}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (files.length > 0) onFiles(files)
        }}
      />
    </>
  )
}
