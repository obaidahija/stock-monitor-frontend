import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SentimentTone = 'positive' | 'negative' | 'neutral'

export function sentimentTone(score: number | null | undefined): SentimentTone {
  if (score === null || score === undefined || score === 0) return 'neutral'
  return score > 0 ? 'positive' : 'negative'
}

const TONE_BAR_CLASS: Record<SentimentTone, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  neutral: 'bg-muted-foreground/40',
}

export const TONE_TEXT_CLASS: Record<SentimentTone, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
}

const TONE_LEGEND: { tone: SentimentTone; label: string }[] = [
  { tone: 'positive', label: 'Bullish' },
  { tone: 'neutral', label: 'Neutral' },
  { tone: 'negative', label: 'Bearish' },
]

export function SentimentLegend() {
  return (
    <div className="flex items-center gap-3">
      {TONE_LEGEND.map(({ tone, label }) => (
        <span key={tone} className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className={cn('size-2 rounded-full', TONE_BAR_CLASS[tone])} />
          {label}
        </span>
      ))}
    </div>
  )
}

/** A single ranked, horizontal-bar row: rank, a clickable identity slot, a
 * magnitude bar (length = value scaled against the list's max, color = the
 * sentiment tone), a primary value readout, and optional secondary meta
 * text. Used by both TrendingSection (Reddit) and TwitterBestStocksSection
 * so the two leaderboards share one bar-chart implementation. */
export function RankedBarRow({
  rank,
  identity,
  pct,
  tone,
  primaryValue,
  meta,
  onNavigate,
  trailing,
}: {
  rank: number
  identity: ReactNode
  pct: number
  tone: SentimentTone
  primaryValue: ReactNode
  meta?: ReactNode
  onNavigate: () => void
  trailing?: ReactNode
}) {
  return (
    // Fixed row height (rather than padding that grows with content) so
    // every row is identical regardless of section — with equal item counts
    // (both leaderboards fetch 20), the two side-by-side lists then end at
    // the same height instead of drifting apart row by row.
    <div className="group flex h-[52px] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-muted/50">
      <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
        {rank}
      </span>

      <button
        type="button"
        onClick={onNavigate}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <div className="w-24 min-w-0 shrink-0 sm:w-28">{identity}</div>

        <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
          <div
            className={cn('h-full rounded-r-sm transition-[width]', TONE_BAR_CLASS[tone])}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>

        <div className="w-24 shrink-0 text-right sm:w-32">
          <div className="text-sm font-semibold tabular-nums">{primaryValue}</div>
          {meta && <div className="text-muted-foreground truncate text-xs">{meta}</div>}
        </div>
      </button>

      {trailing}
    </div>
  )
}
