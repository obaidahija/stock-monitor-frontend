import { UniverseTable } from '@/features/discover/universe-table'
import { SectorHeatmap } from '@/features/discover/sector-heatmap'
import { MacroAttentionStrip } from '@/features/discover/macro-attention-strip'
import { UpcomingMacroEvents } from '@/features/discover/upcoming-macro-events'
import { NotableFilingsSection } from '@/features/discover/notable-filings-section'
import { SocialBuzzStrip } from '@/features/discover/social-buzz-strip'
import { PriceTargetChangesStrip } from '@/features/discover/price-target-changes-strip'
import { GoogleFinanceOutlookSection } from '@/features/google-finance-outlook/google-finance-outlook-section'

/** Scans the whole market. Research First, Fresh Catalysts and Short Squeeze live on the Research page. */
export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <UpcomingMacroEvents />
      <MacroAttentionStrip />
      <SocialBuzzStrip />
      <PriceTargetChangesStrip />
      <GoogleFinanceOutlookSection />
      <SectorHeatmap />
      <UniverseTable />
      <NotableFilingsSection />
    </div>
  )
}
