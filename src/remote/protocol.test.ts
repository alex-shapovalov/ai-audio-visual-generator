import { describe, expect, it } from "vitest"
import { isMessage } from "@/remote/protocol"

describe("isMessage", () => {
  it.each([
    ["library-changed", { kind: "library-changed" }],
    ["a snapshot", { kind: "snapshot", snapshot: { auto: true } }],
    ["a scene command", { kind: "command", command: { type: "scene", scene: "rift" } }],
    ["a stop command", { kind: "command", command: { type: "stop" } }],
    ["a demo command", { kind: "command", command: { type: "demo" } }],
  ])("accepts %s", (_name, value) => {
    expect(isMessage(value)).toBe(true)
  })

  it.each([
    ["null", null],
    ["a string", "scene"],
    ["a number", 7],
    ["an array", []],
    ["an object without a kind", {}],
    ["an unknown kind", { kind: "hello" }],
    ["a command without a body", { kind: "command" }],
    ["a command with a numeric type", { kind: "command", command: { type: 3 } }],
    ["a command of an unknown type", { kind: "command", command: { type: "reboot" } }],
    ["a snapshot that is not an object", { kind: "snapshot", snapshot: "full" }],
  ])("rejects %s", (_name, value) => {
    expect(isMessage(value)).toBe(false)
  })
})
