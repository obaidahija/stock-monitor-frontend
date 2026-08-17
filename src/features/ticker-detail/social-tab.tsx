import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatRelativeTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSocial } from './hooks'

const TREND_META: Record<string, string> = {
  rising: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  falling: 'bg-red-500/15 text-red-600 dark:text-red-400',
  stable: 'bg-muted text-muted-foreground',
}

export function SocialTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useSocial(ticker)

  if (isPending) return <Skeleton className="h-56 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  if (!data) {
    return (
      <EmptyState
        title="No Reddit sentiment data yet"
        description="Populated once/day by the social_ingest job for user-added custom tickers (Adanos API, budget-limited)."
      />
    )
  }

  const trendClass = data.trend ? (TREND_META[data.trend] ?? TREND_META.stable) : TREND_META.stable

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {data.trend && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize',
              trendClass,
            )}
          >
            {data.trend}
          </span>
        )}
        <span className="text-muted-foreground text-sm">
          Reddit · updated {formatRelativeTime(data.snapshot_at)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buzz score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.buzz_score !== null ? data.buzz_score.toFixed(0) : '—'}
              <span className="text-muted-foreground text-sm font-normal"> / 100</span>
            </p>
            <p className="text-muted-foreground text-sm">
              {data.mentions !== null ? `${data.mentions.toLocaleString()} mentions` : 'Mentions unknown'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatScore(data.sentiment_score)}
            </p>
            <p className="text-muted-foreground text-sm">
              {data.bullish_pct !== null ? `${data.bullish_pct.toFixed(0)}% bullish` : '—'} ·{' '}
              {data.bearish_pct !== null ? `${data.bearish_pct.toFixed(0)}% bearish` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Source: Reddit via Adanos. Informational only, not a recommendation.
      </p>
    </div>
  )
}
