import {
  easternDaysUntil,
  formatDate,
  formatRelativeTime,
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatSignedPct,
} from '@/lib/format'
import { LEAN_COLOR_CLASSES } from '@/lib/lean-colors'
import { cn } from '@/lib/utils'
import type { AnalysisLean } from '@/types/api'
import { useEarnings, useUniverseScore, useQuote, useIndustryPerformance } from './hooks'

function countdown(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/** Shared quote, company details, score and earnings information for every tab. */
export function TickerHeaderStats({ ticker }: { ticker: string }) {
  const { data: universe } = useUniverseScore(ticker)
  const { data: quote } = useQuote(ticker)
  const { data: earnings } = useEarnings(ticker)
  const industryPerformance = useIndustryPerformance(universe?.sector ?? null, universe?.industry ?? null)
  const industryChange = industryPerformance?.avg_change_pct ?? null
  const next = earnings?.next ?? null
  const score = universe?.score ?? null
  if (!universe && !quote && !next) return null

  const details = [
    ['Market cap', formatCompactCurrency(universe?.market_cap)],
    ['P/E ratio', quote?.pe_ratio != null ? `${quote.pe_ratio.toFixed(2)}x` : '—'],
    ['Volume', formatCompactNumber(quote?.volume)],
    ['Avg. volume (20D)', formatCompactNumber(universe?.avg_volume_20d)],
    ['Previous close', formatCurrency(quote?.previous_close)],
    ['Sector', universe?.sector ?? '—'],
  ]

  const lean = (universe?.lean ?? 'neutral') as AnalysisLean

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {score !== null && (
          <span
            title={`Universe score, updated ${formatRelativeTime(universe?.score_updated_at)}`}
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
              LEAN_COLOR_CLASSES[lean] ?? LEAN_COLOR_CLASSES.neutral,
            )}
          >
            {score.toFixed(0)}/100 · {lean}
          </span>
        )}
        {next && (
          <span className="text-muted-foreground">
            Next earnings {formatDate(next.event_date)}
            {next.bmo_amc && next.bmo_amc !== 'unknown' && ` · ${next.bmo_amc.toUpperCase()}`}
            {` · ${countdown(easternDaysUntil(next.event_date))}`}
          </span>
        )}
      </div>
      <dl
        aria-label="Ticker details"
        className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.4fr)_minmax(0,2fr)]"
      >
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <dt className="text-xs text-muted-foreground">Industry</dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium">
            <span>{universe?.industry || '—'}</span>
            {industryChange !== null ? (
              <span
                title="Average daily change of tracked stocks in this industry, using latest available quotes"
                className={cn(
                  'text-xs tabular-nums',
                  industryChange > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : industryChange < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground',
                )}
              >
                {industryChange > 0 ? 'Up' : industryChange < 0 ? 'Down' : 'Flat'}{' '}
                {formatSignedPct(industryChange)} today
              </span>
            ) : universe?.industry ? (
              <span className="text-xs text-muted-foreground">Daily change unavailable</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </div>
  )
}
