import { UniverseTable } from '@/features/discover/universe-table'
import { SectorHeatmap } from '@/features/discover/sector-heatmap'
import { MacroAttentionStrip } from '@/features/discover/macro-attention-strip'
import { NotableFilingsSection } from '@/features/discover/notable-filings-section'
import { SocialBuzzStrip } from '@/features/discover/social-buzz-strip'
import { GoogleFinanceOutlookSection } from '@/features/google-finance-outlook/google-finance-outlook-section'

export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <MacroAttentionStrip />
      <SocialBuzzStrip />
      <GoogleFinanceOutlookSection />
      <SectorHeatmap />
      <UniverseTable />
      <NotableFilingsSection />
    </div>
  )
}
