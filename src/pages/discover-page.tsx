import { UniverseTable } from '@/features/discover/universe-table'
import { DiscoverResearchFirst } from '@/features/research-first/research-first-panel'
import { SectorHeatmap } from '@/features/discover/sector-heatmap'
import { MacroAttentionStrip } from '@/features/discover/macro-attention-strip'
import { UpcomingMacroEvents } from '@/features/discover/upcoming-macro-events'
import { FreshCatalystsSection } from '@/features/discover/fresh-catalysts-section'
import { NotableFilingsSection } from '@/features/discover/notable-filings-section'
import { SocialBuzzStrip } from '@/features/discover/social-buzz-strip'
import { GoogleFinanceOutlookSection } from '@/features/google-finance-outlook/google-finance-outlook-section'

export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <DiscoverResearchFirst />
      <UpcomingMacroEvents />
      <MacroAttentionStrip />
      <SocialBuzzStrip />
      <GoogleFinanceOutlookSection />
      <FreshCatalystsSection />
      <SectorHeatmap />
      <UniverseTable />
      <NotableFilingsSection />
    </div>
  )
}
