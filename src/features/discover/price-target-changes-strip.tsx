import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getAnalystPriceTargetChanges } from '@/api/discover'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PriceTargetChangeSummaryOut } from '@/types/api'

const DIRECTION_TEXT: Record<'up' | 'down', string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
}

const DIRECTION_BORDER_TINT: Record<'up' | 'down', string> = {
  up: 'border-emerald-500/40 bg-emerald-500/10',
  down: 'border-red-500/40 bg-red-500/10',
}

function direction(change: PriceTargetChangeSummaryOut): 'up' | 'down' {
  return (change.pct_change ?? 0) >= 0 ? 'up' : 'down'
}

// "Lit" when the live price sits at least this far below the new target --
// i.e. the target implies meaningful room left to rise, not just a token gap.
const UPSIDE_LIGHT_THRESHOLD_PCT = 15

function isLit(change: PriceTargetChangeSummaryOut): boolean {
  return change.upside_to_target_pct !== null && change.upside_to_target_pct >= UPSIDE_LIGHT_THRESHOLD_PCT
}

function UpsideLight({ change }: { change: PriceTargetChangeSummaryOut }) {
  if (change.upside_to_target_pct === null) return null
  const lit = isLit(change)
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full transition-colors',
        lit
          ? 'bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.7)]'
          : 'bg-muted-foreground/25',
      )}
      aria-hidden="true"
    />
  )
}

type SortMode = 'recent' | 'magnitude' | 'ticker'

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Most recent',
  magnitude: 'Biggest change',
  ticker: 'Ticker (A–Z)',
}

// Stable reference so useMemo's dependency doesn't change on every render
// while the query is still loading (data ?? [] would otherwise allocate a
// new empty array each time).
const EMPTY_CHANGES: PriceTargetChangeSummaryOut[] = []

function sortChanges(changes: PriceTargetChangeSummaryOut[], mode: SortMode) {
  const sorted = [...changes]
  if (mode === 'magnitude') {
    sorted.sort((a, b) => Math.abs(b.pct_change ?? 0) - Math.abs(a.pct_change ?? 0))
  } else if (mode === 'ticker') {
    sorted.sort((a, b) => a.ticker.localeCompare(b.ticker))
  }
  // 'recent' keeps the API's own newest-first order.
  return sorted
}

/** Tickers with a recent (last 7 days), qualifying analyst price-target
 * revision -- see analyst_price_target_scan / analyst_price_target_service.
 * "Qualifying" already means a meaningful percent move (the min-pct-change
 * threshold), so every item here is worth a glance, not just noise.
 *
 * A tracked universe of ~900 tickers can easily produce 100+ of these in a
 * week, so unlike MacroAttentionStrip's handful of sector pills this scrolls
 * horizontally in one line rather than wrapping into a wall of chips, and
 * carries its own search/sort since there's too much here to just eyeball. */
export function PriceTargetChangesStrip() {
  const { data } = useQuery({
    queryKey: ['analyst-price-target-changes'],
    queryFn: () => getAnalystPriceTargetChanges(7),
  })
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  const changes = data ?? EMPTY_CHANGES
  const visible = useMemo(() => {
    const query = search.trim().toUpperCase()
    const filtered = query ? changes.filter((c) => c.ticker.includes(query)) : changes
    return sortChanges(filtered, sortMode)
  }, [changes, search, sortMode])

  if (changes.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Analyst price-target moves
        </h2>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker…"
            aria-label="Search analyst price-target moves by ticker"
            className="h-8 w-32 text-xs"
          />
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Sort analyst price-target moves">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-xs">No matches for "{search}".</p>
      ) : (
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Tickers with a recent analyst price-target revision"
        >
          {visible.map((change) => {
            const dir = direction(change)
            const Icon = dir === 'up' ? TrendingUp : TrendingDown
            const pct = change.pct_change
            const upside = change.upside_to_target_pct
            return (
              <Tooltip key={`${change.ticker}-${change.action_at}`}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/stocks/${change.ticker}?tab=analysis`}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      DIRECTION_BORDER_TINT[dir],
                    )}
                  >
                    <UpsideLight change={change} />
                    <Icon className={cn('size-3.5 shrink-0', DIRECTION_TEXT[dir])} aria-hidden="true" />
                    <span className="text-foreground">{change.ticker}</span>
                    {pct !== null && (
                      <span className={cn('tabular-nums', DIRECTION_TEXT[dir])}>
                        {pct > 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="space-y-1">
                  <p className="font-medium">{change.firm}</p>
                  <p>
                    Target: {formatCurrency(change.prior_price_target)} →{' '}
                    {formatCurrency(change.current_price_target)} ({formatSignedPct(change.pct_change, 1)})
                  </p>
                  {change.current_price !== null && (
                    <p>Current price: {formatCurrency(change.current_price)}</p>
                  )}
                  {upside !== null &&
                    (upside >= 0 ? (
                      <p>{upside.toFixed(1)}% below target (upside)</p>
                    ) : (
                      <p>{Math.abs(upside).toFixed(1)}% above target already</p>
                    ))}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}
