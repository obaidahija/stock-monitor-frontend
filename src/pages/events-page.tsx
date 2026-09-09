import { PageHeader } from '@/components/shared/page-header'
import { MarketEventsList } from '@/features/market-events/market-events-list'

export function EventsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Events"
        description="Scheduled US macro/market events for the week ahead, with predicted sector impact and post-event grading against realized sector moves."
      />
      <MarketEventsList />
    </div>
  )
}
