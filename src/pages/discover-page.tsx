import { DiscoverResearchFirst } from '@/features/research-first/research-first-panel'
import { FreshCatalystsSection } from '@/features/discover/fresh-catalysts-section'
import { UniverseTable } from '@/features/discover/universe-table'
import { SectorHeatmap } from '@/features/discover/sector-heatmap'
import { MacroAttentionStrip } from '@/features/discover/macro-attention-strip'
import { UpcomingMacroEvents } from '@/features/discover/upcoming-macro-events'
import { SocialBuzzStrip } from '@/features/discover/social-buzz-strip'
import { PriceTargetChangesStrip } from '@/features/discover/price-target-changes-strip'
import { GoogleFinanceOutlookSection } from '@/features/google-finance-outlook/google-finance-outlook-section'

/** Market discovery with compact research priorities and fresh catalysts. */
export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <DiscoverResearchFirst />
      <UpcomingMacroEvents />
      <MacroAttentionStrip />
      <SocialBuzzStrip />
      <PriceTargetChangesStrip />
      <GoogleFinanceOutlookSection />
      <FreshCatalystsSection />
      <SectorHeatmap />
      <UniverseTable />
    </div>
  )
}
