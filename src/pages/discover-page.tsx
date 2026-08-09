import { PageHeader } from '@/components/shared/page-header'
import { UniverseTable } from '@/features/discover/universe-table'
import { GappersSection } from '@/features/discover/gappers-section'
import { UnusualVolumeSection } from '@/features/discover/unusual-volume-section'
import { NotableFilingsSection } from '@/features/discover/notable-filings-section'
import { TrendingSection } from '@/features/discover/trending-section'

export function DiscoverPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Discover"
        description="The full S&P 500 + extras, scored 0-100 daily. Pin a custom ticker to track it fully regardless of score."
      />

      <UniverseTable />
      <GappersSection />
      <UnusualVolumeSection />
      <NotableFilingsSection />
      <TrendingSection />
    </div>
  )
}
