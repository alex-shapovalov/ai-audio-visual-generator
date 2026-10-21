"use client"

import { LiveTab } from "@/components/deck/live-tab"
import { MediaTab } from "@/components/deck/media-tab"
import { TracksTab } from "@/components/deck/tracks-tab"
import type { Deck } from "@/components/deck/use-deck"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ControlTabsProps = { deck: Deck; liveEnabled?: boolean }

export function ControlTabs({ deck, liveEnabled = true }: ControlTabsProps) {
  return (
    <Tabs defaultValue="live" className="min-h-0 flex-1 gap-0">
      <TabsList className="w-full">
        <TabsTrigger value="live">Live</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="tracks">Tracks</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <TabsContent value="live">
          <LiveTab deck={deck} enabled={liveEnabled} />
        </TabsContent>
        <TabsContent value="media">
          <MediaTab deck={deck} />
        </TabsContent>
        <TabsContent value="tracks">
          <TracksTab deck={deck} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
