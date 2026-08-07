import { ListChecks } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { AddTickerDialog } from '@/features/watchlist/add-ticker-dialog'
import { WatchlistTable } from '@/features/watchlist/watchlist-table'
import { useWatchlist } from '@/features/watchlist/hooks'

export function WatchlistPage() {
  const { data: items, isPending, isError, error, refetch } = useWatchlist()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        description="Tickers tracked for filings, earnings, news, and premarket movement."
        actions={<AddTickerDialog />}
      />

      {isPending && <Skeleton className="h-64 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {items && items.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="No tickers yet"
          description="Add a ticker to start tracking it."
          action={<AddTickerDialog />}
        />
      )}

      {items && items.length > 0 && <WatchlistTable items={items} />}
    </div>
  )
}
