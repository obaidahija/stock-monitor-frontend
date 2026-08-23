import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useTrendingSummary } from './hooks'
import { TrendingTickerTable } from './trending-ticker-table'

export function TrendingNewEntrantsList() {
  const query = useTrendingSummary()

  if (query.isPending) {
    return <Skeleton className="h-64" aria-label="Loading new entrants" />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data.new_entrants.length) {
    return (
      <EmptyState
        title="No new breakouts today"
        description="Every trending ticker today also appeared in yesterday's scan."
      />
    )
  }

  return <TrendingTickerTable items={query.data.new_entrants} />
}
