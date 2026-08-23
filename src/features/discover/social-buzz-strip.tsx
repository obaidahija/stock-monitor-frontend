import { TrendingBuzzStrip, TrendingBuzzStripSkeleton } from '@/components/shared/trending-buzz-strip'
import { useTrendingSummary } from '@/features/trending/hooks'

const LIMIT = 50

/**
 * Discover's answer to a tall, per-source bar-chart list: the combined
 * Reddit + Twitter attention ranking (Twitter best-stocks + Reddit
 * top-mentions, merged server-side -- no Adanos), over the sustained
 * "trending in general" window rather than just today's snapshot, so a
 * ticker that's been consistently discussed over the past couple weeks
 * shows up here even without a same-day spike.
 */
export function SocialBuzzStrip() {
  const query = useTrendingSummary(LIMIT)

  if (query.isPending) return <TrendingBuzzStripSkeleton />
  if (query.isError || !query.data) return null

  return (
    <TrendingBuzzStrip
      label="Social buzz"
      headerTooltip={`Combined Reddit + Twitter attention over the last ${query.data.general_lookback_days} days. Click one to jump to its stronger platform's tab.`}
      items={query.data.general}
      onRefresh={() => query.refetch()}
      isRefreshing={query.isFetching}
    />
  )
}
