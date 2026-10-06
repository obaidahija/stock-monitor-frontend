import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { formatCurrency, formatSignedPct, formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuoteOut } from '@/types/api'

const QuoteContext = createContext<{ quotes: QuoteOut[]; pending: boolean; failed: boolean } | null>(null)

export function DigestLiveQuotes({ tickers, children }: { tickers: string[]; children: ReactNode }) {
  const symbols = [...new Set(tickers)].sort()
  const query = useQuery({
    queryKey: ['digest-live-quotes', symbols],
    queryFn: () => apiClient.post<QuoteOut[]>('/v1/digest/quotes/refresh', symbols),
    enabled: symbols.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  return <QuoteContext.Provider value={{ quotes: query.data ?? [], pending: query.isPending, failed: query.isError }}>
    {children}
  </QuoteContext.Provider>
}

export function DigestLivePrice({ ticker }: { ticker: string }) {
  const context = useContext(QuoteContext)
  if (!context) return null
  const quote = context.quotes.find((quote) => quote.ticker === ticker.toUpperCase())
  if (!quote || (quote.session_price ?? quote.price) === null) {
    return <p className="text-muted-foreground text-xs">{context.pending ? 'Loading price…' : 'Price unavailable'}</p>
  }
  const extended = quote.market_session === 'pre_market' || quote.market_session === 'post_market' || quote.market_session === 'overnight'
  const price = quote.session_price ?? quote.price
  const amount = extended ? quote.session_change_amount : quote.change_amount
  const pct = extended ? quote.session_change_pct : quote.change_pct
  const time = quote.session_time ?? quote.regular_market_time
  const label = { pre_market: 'Premarket', post_market: 'After hours', overnight: 'Overnight', regular: 'Regular', closed: 'Closed' }[quote.market_session ?? 'closed']
  return <div className="space-y-0.5 tabular-nums" aria-label={`${ticker} current quote`}>
    <div className="font-semibold">{formatCurrency(price)}</div>
    <div className={cn('text-sm', (pct ?? amount ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : (pct ?? amount ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
      {amount !== null && `${amount > 0 ? '+' : ''}${formatCurrency(amount)} · `}{formatSignedPct(pct)}
    </div>
    <p className="text-muted-foreground text-xs">{label}{time && ` · ${formatEasternDateTime(time)}`}{context.failed && ' · Refresh failed'}</p>
  </div>
}
