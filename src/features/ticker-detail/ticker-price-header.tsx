import { formatCurrency, formatEasternDateTime, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useQuote } from '@/features/ticker-detail/hooks'
import type { QuoteOut } from '@/types/api'

const SESSION_LABEL: Record<NonNullable<QuoteOut['market_session']>, string> = {
  overnight: 'Overnight',
  pre_market: 'Pre-market',
  regular: 'Regular',
  post_market: 'Post-market',
  closed: 'Closed',
}

export function TickerPriceHeader({ ticker }: { ticker: string }) {
  const { data: quote } = useQuote(ticker)
  if (!quote || quote.price === null) return null

  const showSession =
    quote.market_session === 'pre_market' ||
    quote.market_session === 'post_market' ||
    quote.market_session === 'overnight'

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-normal tabular-nums">
      <span className="text-base font-medium">{formatCurrency(quote.price)}</span>
      {quote.change_pct !== null && (
        <span
          className={cn(
            'font-medium',
            quote.change_pct > 0 && 'text-emerald-600 dark:text-emerald-400',
            quote.change_pct < 0 && 'text-red-600 dark:text-red-400',
            quote.change_pct === 0 && 'text-muted-foreground',
          )}
        >
          {formatSignedPct(quote.change_pct)}
        </span>
      )}
      {showSession && quote.session_price !== null && (
        <span className="text-muted-foreground flex items-baseline gap-1">
          <span>{SESSION_LABEL[quote.market_session as NonNullable<QuoteOut['market_session']>]}:</span>
          <span className="text-foreground">{formatCurrency(quote.session_price)}</span>
          {quote.session_change_pct !== null && (
            <span
              className={cn(
                quote.session_change_pct > 0 && 'text-emerald-600 dark:text-emerald-400',
                quote.session_change_pct < 0 && 'text-red-600 dark:text-red-400',
              )}
            >
              ({formatSignedPct(quote.session_change_pct)})
            </span>
          )}
        </span>
      )}
      {quote.quote_updated_at && (
        <span className="text-muted-foreground text-xs">
          as of {formatEasternDateTime(quote.quote_updated_at)}
        </span>
      )}
    </span>
  )
}
