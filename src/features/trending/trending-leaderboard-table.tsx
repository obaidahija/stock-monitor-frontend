import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import type { TrendingWindow } from '@/api/trending'
import { useTrendingLeaderboard } from './hooks'
import { TrendingTickerTable } from './trending-ticker-table'

const PAGE_SIZE = 25

export function TrendingLeaderboardTable({ window }: { window: TrendingWindow }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const sector = params.get('sector') ?? undefined
  const query = useTrendingLeaderboard({
    window,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sector,
  })

  if (query.isPending) {
    return <Skeleton className="h-64" aria-label="Loading trending leaderboard" />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  if (!query.data.items.length) {
    return (
      <EmptyState
        title="Nothing trending yet"
        description="Twitter/Reddit trend data appears once the daily scans have run."
      />
    )
  }

  return (
    <div className="space-y-3">
      <TrendingTickerTable items={query.data.items} />
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(query.data.total / PAGE_SIZE))}
        onPageChange={(nextPage) =>
          setParams((previous) => {
            const next = new URLSearchParams(previous)
            if (nextPage === 1) next.delete('page')
            else next.set('page', String(nextPage))
            return next
          })
        }
      />
    </div>
  )
}
