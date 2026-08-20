import { PageHeader } from '@/components/shared/page-header'
import { MacroSignalDashboard } from '@/features/macro/macro-signal-dashboard'
import { MacroHistoryChart } from '@/features/macro/macro-history-chart'
import { MacroCategoryFilter } from '@/features/macro/macro-category-filter'
import { MacroNewsFeed } from '@/features/macro/macro-news-feed'

export function MacroPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Macro"
        description="Market-wide news — oil & energy, geopolitical conflict, rates & Fed, Treasury & debt, banking & credit, trade & tariffs, inflation — classified separately from per-ticker coverage."
      />
      <MacroSignalDashboard />
      <MacroHistoryChart />
      <div className="space-y-4">
        <MacroCategoryFilter />
        <MacroNewsFeed />
      </div>
    </div>
  )
}
