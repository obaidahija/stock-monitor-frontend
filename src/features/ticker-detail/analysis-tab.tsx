import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAnalysis, useRefreshUniverseScore, useUniverseScore } from './hooks'
import { SentimentTrendChart } from './sentiment-trend-chart'
import type { AnalystDetailOut, AnalysisLean, PriceLevelPosition, PriceLevelsOut } from '@/types/api'

const LEAN_META: Record<AnalysisLean, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

function UniverseScoreBadge({ ticker }: { ticker: string }) {
  const { data, isPending } = useUniverseScore(ticker)
  const refreshUniverseScore = useRefreshUniverseScore(ticker)

  function runRefresh() {
    refreshUniverseScore.mutate(undefined, {
      onSuccess: (result) => {
        if (result.scored) {
          const newsPart = result.news_classified
            ? `, ${result.news_classified} news article${result.news_classified === 1 ? '' : 's'} classified`
            : ''
          toast.success(
            `Refreshed universe score for ${result.ticker}: ${result.score}/100${newsPart}`,
          )
        } else {
          toast.error(`Failed to refresh universe score for ${result.ticker}: ${result.error}`)
        }
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError && typeof err.detail === 'string'
            ? err.detail
            : `Failed to refresh universe score for ${ticker}`,
        )
      },
    })
  }

  const refreshButton = (
    <Button
      size="sm"
      variant="outline"
      disabled={refreshUniverseScore.isPending}
      onClick={runRefresh}
    >
      <RefreshCw className={cn(refreshUniverseScore.isPending && 'animate-spin')} />
      Refresh score
    </Button>
  )

  if (isPending) return null

  if (!data || data.score === null) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          Not in tracked universe — no daily universe score
        </span>
        {refreshButton}
      </span>
    )
  }

  const leanClass = data.lean ? (LEAN_META[data.lean as AnalysisLean] ?? LEAN_META.neutral) : LEAN_META.neutral

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
          leanClass,
        )}
      >
        Universe score {data.score.toFixed(0)}/100
      </span>
      <span className="text-muted-foreground text-xs">
        updated {formatRelativeTime(data.score_updated_at)}
      </span>
      {refreshButton}
    </span>
  )
}

const POSITION_META: Record<PriceLevelPosition, { label: string; className: string }> = {
  near_support: { label: 'Near support', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  near_resistance: { label: 'Near resistance', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  mid_range: { label: 'Mid-range', className: 'bg-muted text-muted-foreground' },
  below_support: { label: 'Below usual support', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  above_resistance: { label: 'Above usual resistance', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}

function PriceLevelsCard({ priceLevels }: { priceLevels: PriceLevelsOut }) {
  const meta = POSITION_META[priceLevels.position]
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reference price levels</CardTitle>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
            meta.className,
          )}
        >
          {meta.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Support</p>
            <p className="text-sm font-medium">
              {priceLevels.support !== null
                ? `${formatCurrency(priceLevels.support)} (${priceLevels.support_label})`
                : 'None identified'}
            </p>
          </div>
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Resistance</p>
            <p className="text-sm font-medium">
              {priceLevels.resistance !== null
                ? `${formatCurrency(priceLevels.resistance)} (${priceLevels.resistance_label})`
                : 'None identified'}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{priceLevels.note}</p>
        <p className="text-muted-foreground text-xs">
          Reference levels only, not a recommendation to buy or sell.
        </p>
      </CardContent>
    </Card>
  )
}

const RATING_BAR_META: {
  key: keyof Pick<AnalystDetailOut, 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'>
  label: string
  barClassName: string
  dotClassName: string
}[] = [
  { key: 'strong_buy', label: 'Strong buy', barClassName: 'bg-emerald-600', dotClassName: 'bg-emerald-600' },
  { key: 'buy', label: 'Buy', barClassName: 'bg-emerald-400', dotClassName: 'bg-emerald-400' },
  { key: 'hold', label: 'Hold', barClassName: 'bg-muted-foreground/40', dotClassName: 'bg-muted-foreground/40' },
  { key: 'sell', label: 'Sell', barClassName: 'bg-red-400', dotClassName: 'bg-red-400' },
  { key: 'strong_sell', label: 'Strong sell', barClassName: 'bg-red-600', dotClassName: 'bg-red-600' },
]

function AnalystDetailCard({ detail }: { detail: AnalystDetailOut }) {
  const ratingCounts = RATING_BAR_META.map((meta) => ({ ...meta, count: detail[meta.key] ?? 0 }))
  const totalRatings = ratingCounts.reduce((sum, r) => sum + r.count, 0)
  const hasTargets =
    detail.price_target_low !== null ||
    detail.price_target_mean !== null ||
    detail.price_target_median !== null ||
    detail.price_target_high !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Analyst detail</CardTitle>
        {detail.num_analysts !== null && (
          <span className="text-muted-foreground text-sm">{detail.num_analysts} analysts</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {totalRatings > 0 && (
          <div className="space-y-2">
            <div className="border-border flex h-2.5 overflow-hidden rounded-full border">
              {ratingCounts.map(
                (r) =>
                  r.count > 0 && (
                    <div
                      key={r.key}
                      className={cn(r.barClassName)}
                      style={{ width: `${(r.count / totalRatings) * 100}%` }}
                      title={`${r.label}: ${r.count}`}
                    />
                  ),
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {ratingCounts.map(
                (r) =>
                  r.count > 0 && (
                    <span key={r.key} className="text-muted-foreground inline-flex items-center gap-1.5">
                      <span className={cn('inline-block size-2 rounded-full', r.dotClassName)} />
                      {r.label} {r.count}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {hasTargets && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Low</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_low)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Median</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_median)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Mean</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_mean)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">High</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_high)}</p>
            </div>
          </div>
        )}

        {detail.recent_actions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">Recent rating actions</p>
            <div className="space-y-1">
              {detail.recent_actions.map((action, i) => (
                <div
                  key={i}
                  className="border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b py-1 text-sm last:border-b-0"
                >
                  <span className="font-medium">{action.firm}</span>
                  <span className="text-muted-foreground text-xs">
                    {action.from_grade && action.to_grade
                      ? `${action.from_grade} → ${action.to_grade}`
                      : action.to_grade ?? action.action ?? '—'}
                    {' · '}
                    {formatDate(action.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalysisTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useAnalysis(ticker)

  if (isPending) return <Skeleton className="h-72 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize',
            LEAN_META[data.lean],
          )}
        >
          {data.lean}
        </span>
        <span className="text-muted-foreground text-sm">
          Overall score {formatScore(data.overall_score)} · generated {formatDateTime(data.generated_at)}
        </span>
        <UniverseScoreBadge ticker={ticker} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.components.map((component) => (
          <Card key={component.name}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{component.name}</CardTitle>
              <span className="text-sm font-medium tabular-nums">
                {formatScore(component.score)}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{component.explanation}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.price_levels && <PriceLevelsCard priceLevels={data.price_levels} />}
      {data.analyst_detail && <AnalystDetailCard detail={data.analyst_detail} />}

      <SentimentTrendChart ticker={ticker} />

      {data.caveats.length > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          {data.caveats.map((caveat, i) => (
            <p key={i}>⚠ {caveat}</p>
          ))}
        </div>
      )}
    </div>
  )
}
