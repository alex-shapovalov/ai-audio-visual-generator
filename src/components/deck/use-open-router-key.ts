"use client"

import { useSyncExternalStore } from "react"
import { KEY_STORAGE } from "@/lib/openrouter"

const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

const readKey = () => {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? ""
  } catch {
    return ""
  }
}

const writeKey = (value: string) => {
  try {
    if (value) {
      window.localStorage.setItem(KEY_STORAGE, value)
    } else {
      window.localStorage.removeItem(KEY_STORAGE)
    }
  } catch {
    return
  } finally {
    listeners.forEach((listener) => listener())
  }
}

export const useOpenRouterKey = () => {
  const key = useSyncExternalStore(subscribe, readKey, () => "")
  return { key, setKey: writeKey }
}
