import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatCurrency, formatEasternDateTime, formatScore, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useQuote } from '@/features/ticker-detail/hooks'
import type { QuoteOut } from '@/types/api'

const SESSION_LABEL: Record<NonNullable<QuoteOut['market_session']>, string> = {
  overnight: 'Overnight',
  pre_market: 'Pre-market',
  regular: 'Regular',
  post_market: 'After hours',
  closed: 'Closed',
}

function changeTextColor(value: number | null) {
  if (value === null || value === 0) return 'text-muted-foreground'
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

function ChangePill({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const isUp = pct > 0
  const isFlat = pct === 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-medium',
        isFlat
          ? 'bg-muted text-muted-foreground'
          : isUp
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
      )}
    >
      {!isFlat && (isUp ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
      {formatSignedPct(pct)}
    </span>
  )
}

export function TickerPriceHeader({ ticker }: { ticker: string }) {
  const { data: quote } = useQuote(ticker)
  if (!quote || quote.price === null) return null

  const showSession =
    quote.market_session === 'pre_market' ||
    quote.market_session === 'post_market' ||
    quote.market_session === 'overnight'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
        <span className="text-3xl leading-none font-semibold">{formatCurrency(quote.price)}</span>
        <span className="text-muted-foreground text-sm">USD</span>
        <ChangePill pct={quote.change_pct} />
        {quote.change_amount !== null && (
          <span className={cn('text-sm font-medium', changeTextColor(quote.change_amount))}>
            {formatScore(quote.change_amount)} today
          </span>
        )}
      </div>
      {quote.regular_market_time && (
        <div className="text-muted-foreground text-xs">
          {showSession && 'Closed: '}
          {formatEasternDateTime(quote.regular_market_time)}
        </div>
      )}
      {showSession && quote.session_price !== null && (
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm tabular-nums">
          <span className="text-muted-foreground">
            {SESSION_LABEL[quote.market_session as NonNullable<QuoteOut['market_session']>]}
          </span>
          <span className="font-medium">{formatCurrency(quote.session_price)}</span>
          {quote.session_change_amount !== null && (
            <span className={changeTextColor(quote.session_change_amount)}>
              {formatScore(quote.session_change_amount)}
              {quote.session_change_pct !== null && ` (${formatSignedPct(quote.session_change_pct)})`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
