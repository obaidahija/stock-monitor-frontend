import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatSignedPct } from '@/lib/format'
import type { TrendingSentimentOverviewOut } from '@/types/api'
import { useTrendingSummary } from './hooks'

function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-2xl font-semibold capitalize">{value}</p>
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function dominantMood(overview: TrendingSentimentOverviewOut): 'bullish' | 'bearish' | 'neutral' {
  const counts = {
    bullish: overview.bullish_count,
    bearish: overview.bearish_count,
    neutral: overview.neutral_count,
  } as const
  return (Object.keys(counts) as (keyof typeof counts)[]).reduce(
    (best, key) => (counts[key] > counts[best] ? key : best),
    'neutral',
  )
}

export function TrendingHeroStats() {
  const query = useTrendingSummary()

  if (query.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    )
  }
  if (query.isError || !query.data) return null

  const { platform_overlap, new_entrants, sectors, sentiment_overview } = query.data
  const totalTrending = platform_overlap.twitter_only + platform_overlap.reddit_only + platform_overlap.both
  const hottestSector = sectors[0] ?? null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Trending today" value={formatNumber(totalTrending)} />
      <StatTile label="New today" value={formatNumber(new_entrants.length)} />
      <StatTile
        label="Hottest sector"
        value={hottestSector?.sector ?? '—'}
        sub={
          hottestSector?.etf_trend_pct !== null && hottestSector?.etf_trend_pct !== undefined
            ? `${formatSignedPct(hottestSector.etf_trend_pct)} sector ETF`
            : undefined
        }
      />
      <StatTile label="Crowd mood" value={dominantMood(sentiment_overview)} />
    </div>
  )
}
