import { CHANNEL_NAME, isMessage, type Command, type DisplaySnapshot, type Message } from "@/remote/protocol"

type Listener = (message: Message) => void

export class RemoteChannel {
  private channel: BroadcastChannel | null = null
  private readonly listeners = new Set<Listener>()

  readonly sendCommand = (command: Command) => this.send({ kind: "command", command })

  readonly publish = (snapshot: DisplaySnapshot) => this.send({ kind: "snapshot", snapshot })

  readonly announceLibraryChange = () => this.send({ kind: "library-changed" })

  open() {
    if (this.channel) return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data
      if (!isMessage(data)) return
      this.listeners.forEach((listener) => listener(data))
    }
    this.channel = channel
  }

  close() {
    this.channel?.close()
    this.channel = null
  }

  send(message: Message) {
    this.channel?.postMessage(message)
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
