import { afterEach, describe, expect, it } from "vitest"
import { RemoteChannel } from "@/remote/channel"
import { CHANNEL_NAME, type Message } from "@/remote/protocol"

const open: { close: () => void }[] = []

const connect = () => {
  const channel = new RemoteChannel()
  channel.open()
  open.push(channel)
  return channel
}

const next = (channel: RemoteChannel) =>
  new Promise<Message>((resolve) => {
    const stop = channel.subscribe((message) => {
      stop()
      resolve(message)
    })
  })

const quiet = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

afterEach(() => {
  open.splice(0).forEach((channel) => channel.close())
})

describe("RemoteChannel", () => {
  it("delivers a command to the other window", async () => {
    const controls = connect()
    const display = connect()
    const received = next(display)

    controls.sendCommand({ type: "scene", scene: "lasers" })

    await expect(received).resolves.toEqual({ kind: "command", command: { type: "scene", scene: "lasers" } })
  })

  it("delivers snapshots and library announcements", async () => {
    const controls = connect()
    const display = connect()
    const announced = next(controls)

    display.announceLibraryChange()

    await expect(announced).resolves.toEqual({ kind: "library-changed" })
  })

  it("does not echo a message back to its sender", async () => {
    const sender = connect()
    connect()
    const heard: Message[] = []
    sender.subscribe((message) => heard.push(message))

    sender.announceLibraryChange()
    await quiet(50)

    expect(heard).toEqual([])
  })

  it("ignores messages that do not belong to the protocol", async () => {
    const display = connect()
    const heard: Message[] = []
    display.subscribe((message) => heard.push(message))
    const stranger = new BroadcastChannel(CHANNEL_NAME)

    stranger.postMessage({ kind: "command", command: { type: "reboot" } })
    stranger.postMessage("hello")
    stranger.postMessage({ kind: "library-changed" })
    await quiet(50)
    stranger.close()

    expect(heard).toEqual([{ kind: "library-changed" }])
  })

  it("stops delivering after unsubscribe", async () => {
    const controls = connect()
    const display = connect()
    const heard: Message[] = []
    const unsubscribe = display.subscribe((message) => heard.push(message))

    controls.announceLibraryChange()
    await quiet(50)
    unsubscribe()
    controls.announceLibraryChange()
    await quiet(50)

    expect(heard).toHaveLength(1)
  })

  it("does nothing when sending before it is opened or after it is closed", () => {
    const channel = new RemoteChannel()
    expect(() => channel.announceLibraryChange()).not.toThrow()

    const opened = connect()
    opened.close()
    expect(() => opened.announceLibraryChange()).not.toThrow()
  })

  it("can be reopened after a close", async () => {
    const controls = connect()
    const display = connect()
    display.close()
    display.open()
    const received = next(display)

    controls.announceLibraryChange()

    await expect(received).resolves.toEqual({ kind: "library-changed" })
  })
})
