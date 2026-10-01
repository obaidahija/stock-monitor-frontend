import { TrendingDown, TrendingUp } from 'lucide-react'
import { useAnalysis } from './hooks'
import { formatCurrency, formatRelativeTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Surfaces the ticker's most recent qualifying analyst price-target
 * revision (see analyst_price_target_scan / analyst_price_target_service)
 * at the top of the ticker page -- the same event the Analysis tab's
 * Analyst Detail card shows, just promoted above the fold so it isn't
 * missed on a page with ten tabs. Clicking it jumps straight to that card.
 * Renders nothing when there's no recent qualifying change, same
 * silence-by-default convention as the Discover page's alert strips. */
export function PriceTargetChangeBanner({
  ticker,
  onNavigate,
}: {
  ticker: string
  onNavigate: () => void
}) {
  const { data } = useAnalysis(ticker)
  const change = data?.analyst_detail?.recent_price_target_change
  if (!change) return null

  const isCut =
    change.current_price_target !== null &&
    change.prior_price_target !== null &&
    change.current_price_target < change.prior_price_target
  const Icon = change.price_target_action === 'Lowers' || isCut ? TrendingDown : TrendingUp
  const verb = change.price_target_action === 'Lowers' || isCut ? 'cut' : 'raised'

  return (
    <button
      type="button"
      onClick={onNavigate}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:brightness-95',
        isCut
          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">
        {change.firm} {verb} price target
        {change.pct_change !== null && ` ${formatSignedPct(change.pct_change, 1)}`}
      </span>
      {change.prior_price_target !== null && change.current_price_target !== null && (
        <span className="tabular-nums">
          {formatCurrency(change.prior_price_target)} → {formatCurrency(change.current_price_target)}
        </span>
      )}
      <span className="text-muted-foreground">{formatRelativeTime(change.action_at)}</span>
      <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap underline underline-offset-2">
        View in Analysis →
      </span>
    </button>
  )
}
