import { MatcherSession, type ToMatcher } from "@/audio/matcher-protocol"

const session = new MatcherSession((message, transfer = []) => {
  self.postMessage(message, { transfer })
})

self.onmessage = (event: MessageEvent<ToMatcher>) => {
  void session.handle(event.data)
}
