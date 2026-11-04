import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatCurrency, formatSignedPct, formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestQuoteOut } from '@/types/api'
import { useDigestQuotes } from './use-digest-quotes'

type PriceRegistration = { ticker: string; visible: boolean }
type RegisterPrice = (element: HTMLElement, ticker: string) => () => void

const QuoteContext = createContext<{
  quotes: Map<string, DigestQuoteOut>; registerPrice: RegisterPrice
} | null>(null)

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase()
}

export function DigestLiveQuotes({ tickers, children }: { tickers: string[]; children: ReactNode }) {
  const registrations = useRef(new Map<Element, PriceRegistration>())
  const observer = useRef<IntersectionObserver | null>(null)
  const [visibleTickers, setVisibleTickers] = useState<string[]>([])
  const publishVisibleTickers = useCallback(() => {
    const visible = new Set<string>()
    for (const registration of registrations.current.values()) {
      if (registration.visible) visible.add(registration.ticker)
    }
    const next = [...visible].sort()
    setVisibleTickers((previous) => previous.length === next.length && previous.every((ticker, index) => ticker === next[index])
      ? previous : next)
  }, [])
  const registerPrice = useCallback<RegisterPrice>((element, ticker) => {
    const fallback = typeof IntersectionObserver === 'undefined'
    registrations.current.set(element, { ticker, visible: fallback })
    if (fallback) publishVisibleTickers()
    else {
      observer.current ??= new IntersectionObserver((entries) => {
        let changed = false
        for (const entry of entries) {
          const registration = registrations.current.get(entry.target)
          if (registration && registration.visible !== entry.isIntersecting) {
            registration.visible = entry.isIntersecting
            changed = true
          }
        }
        if (changed) publishVisibleTickers()
      }, { rootMargin: '150px' })
      observer.current.observe(element)
    }
    return () => {
      observer.current?.unobserve(element)
      const registration = registrations.current.get(element)
      registrations.current.delete(element)
      if (registration?.visible) publishVisibleTickers()
    }
  }, [publishVisibleTickers])
  useEffect(() => () => {
    observer.current?.disconnect()
    observer.current = null
    registrations.current.clear()
  }, [])
  const allowed = new Set(tickers.map(normalizeTicker))
  const symbols = visibleTickers.filter((ticker) => allowed.has(ticker))
  const quotes = useDigestQuotes(symbols)
  const context = useMemo(() => ({ quotes, registerPrice }), [quotes, registerPrice])
  return <QuoteContext.Provider value={context}>
    {children}
  </QuoteContext.Provider>
}

export function DigestLivePrice({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const context = useContext(QuoteContext)
  const elementRef = useRef<HTMLElement | null>(null)
  const setElementRef = useCallback((element: HTMLElement | null) => { elementRef.current = element }, [])
  const registerPrice = context?.registerPrice
  const symbol = normalizeTicker(ticker)
  useEffect(() => {
    if (!elementRef.current || !registerPrice) return
    return registerPrice(elementRef.current, symbol)
  }, [registerPrice, symbol, compact])
  if (!context) return null
  const quote = context.quotes.get(symbol)
  if (!quote || (quote.session_price ?? quote.price) === null) {
    const label = !quote ? 'Loading price…' : 'Price unavailable'
    return compact
      ? <span ref={setElementRef} className="text-muted-foreground text-xs" aria-label={`${ticker} current quote`} title={quote?.refresh_error ?? undefined}>{label}</span>
      : <div ref={setElementRef} className="text-muted-foreground text-xs" aria-label={`${ticker} current quote`} title={quote?.refresh_error ?? undefined}>{label}</div>
  }
  const extended = quote.market_session === 'pre_market' || quote.market_session === 'post_market' || quote.market_session === 'overnight'
  const price = quote.session_price ?? quote.price
  const amount = extended ? quote.session_change_amount : quote.change_amount
  const pct = extended ? quote.session_change_pct : quote.change_pct
  const time = quote.session_time ?? quote.regular_market_time
  const label = { pre_market: 'Premarket', post_market: 'After hours', overnight: 'Overnight', regular: 'Regular', closed: 'Closed' }[quote.market_session ?? 'closed']
  const refreshNote = quote.refresh_status === 'cached' ? ' · Cached quote · Refresh failed' : ''
  if (compact) return <span ref={setElementRef} className="flex flex-wrap items-baseline gap-x-2 tabular-nums" aria-label={`${ticker} current quote`}>
    <span className="text-sm font-semibold">{formatCurrency(price)}</span>
    <span className={cn('text-xs', (pct ?? amount ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : (pct ?? amount ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
      {amount !== null && `${amount > 0 ? '+' : ''}${formatCurrency(amount)} · `}{formatSignedPct(pct)}
    </span>
    <span className="text-muted-foreground w-full text-xs" title={quote.refresh_error ?? undefined}>{label}{time && ` · ${formatEasternDateTime(time)}`}{refreshNote}</span>
  </span>
  return <div ref={setElementRef} className="space-y-0.5 tabular-nums" aria-label={`${ticker} current quote`}>
    <div className="font-semibold">{formatCurrency(price)}</div>
    <div className={cn('text-sm', (pct ?? amount ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : (pct ?? amount ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
      {amount !== null && `${amount > 0 ? '+' : ''}${formatCurrency(amount)} · `}{formatSignedPct(pct)}
    </div>
    <p className="text-muted-foreground text-xs" title={quote.refresh_error ?? undefined}>{label}{time && ` · ${formatEasternDateTime(time)}`}{refreshNote}</p>
  </div>
}
