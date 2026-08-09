import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatCurrency, formatDateTime, formatRelativeTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAnalysis, useUniverseScore } from './hooks'
import { SentimentTrendChart } from './sentiment-trend-chart'
import type { AnalysisLean, PriceLevelPosition, PriceLevelsOut } from '@/types/api'

const LEAN_META: Record<AnalysisLean, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

function UniverseScoreBadge({ ticker }: { ticker: string }) {
  const { data, isPending } = useUniverseScore(ticker)

  if (isPending) return null

  if (!data || data.score === null) {
    return (
      <span className="text-muted-foreground text-sm">
        Not in tracked universe — no daily universe score
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
