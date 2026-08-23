import { TrendingBuzzStrip, TrendingBuzzStripSkeleton } from '@/components/shared/trending-buzz-strip'
import { useTrendingSummary } from './hooks'

const LIMIT = 50

/** Trending page's "Hot right now": today's combined Reddit + Twitter leaderboard. */
export function TrendingHotStrip() {
  const query = useTrendingSummary(LIMIT)

  if (query.isPending) return <TrendingBuzzStripSkeleton />
  if (query.isError || !query.data) return null

  return (
    <TrendingBuzzStrip
      label="Hot right now"
      headerTooltip="Today's combined Reddit + Twitter trending leaderboard."
      items={query.data.today}
      onRefresh={() => query.refetch()}
      isRefreshing={query.isFetching}
    />
  )
}
