import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompetitorsTab } from './competitors/competitors-tab'
import type { PeersView } from './detail-tabs'
import { PairsTab } from './pairs/pairs-tab'

/** Google Finance's two peer tools for one stock: named competitors and price-checked pairs. */
export function PeersTab({
  ticker,
  view,
  onViewChange,
}: {
  ticker: string
  view: PeersView
  onViewChange: (view: PeersView) => void
}) {
  return (
    <Tabs value={view} onValueChange={(value) => onViewChange(value as PeersView)} className="gap-4">
      <TabsList aria-label="Peer tools">
        <TabsTrigger value="competitors">Competitors</TabsTrigger>
        <TabsTrigger value="pairs">Pairs</TabsTrigger>
      </TabsList>
      <TabsContent value="competitors">
        <CompetitorsTab ticker={ticker} />
      </TabsContent>
      <TabsContent value="pairs">
        <PairsTab ticker={ticker} />
      </TabsContent>
    </Tabs>
  )
}
