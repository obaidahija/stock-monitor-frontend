import { easternDaysUntil, formatDate, formatRelativeTime } from '@/lib/format'
import { LEAN_COLOR_CLASSES } from '@/lib/lean-colors'
import { cn } from '@/lib/utils'
import type { AnalysisLean } from '@/types/api'
import { useEarnings, useUniverseScore } from './hooks'

function countdown(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/** The score and the next earnings date: the two facts every tab needs, shown once under the price. */
export function TickerHeaderStats({ ticker }: { ticker: string }) {
  const { data: universe } = useUniverseScore(ticker)
  const { data: earnings } = useEarnings(ticker)
  const next = earnings?.next ?? null
  const score = universe?.score ?? null
  if (score === null && !next) return null

  const lean = (universe?.lean ?? 'neutral') as AnalysisLean

  return (
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
  )
}
