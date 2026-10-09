import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FilingsView } from './detail-tabs'
import { FilingsTab } from './filings-tab'
import { InsiderTab } from './insider-tab'

/** Form 4 insider trades first, every SEC filing one switch away. */
export function FilingsInsiderTab({
  ticker,
  view,
  onViewChange,
}: {
  ticker: string
  view: FilingsView
  onViewChange: (view: FilingsView) => void
}) {
  return (
    <Tabs value={view} onValueChange={(value) => onViewChange(value as FilingsView)} className="gap-4">
      <TabsList aria-label="Filing views">
        <TabsTrigger value="insider">Insider trades</TabsTrigger>
        <TabsTrigger value="all">All filings</TabsTrigger>
      </TabsList>
      <TabsContent value="insider">
        <InsiderTab ticker={ticker} />
      </TabsContent>
      <TabsContent value="all">
        <FilingsTab ticker={ticker} />
      </TabsContent>
    </Tabs>
  )
}
