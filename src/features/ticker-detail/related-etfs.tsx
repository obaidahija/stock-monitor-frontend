import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Minus } from 'lucide-react'
import { getRelatedEtfDescription, getRelatedEtfs, refreshRelatedEtfQuotes } from '@/api/stocks'
import { Button } from '@/components/ui/button'
import { useQuote } from '@/features/ticker-detail/hooks'
import { regularTradingDate, relativeGap } from '@/features/ticker-detail/related-etf-math'
import { formatDate, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuoteOut, RelatedEtfOut, RelatedEtfsOut } from '@/types/api'

function EtfDescription({ ticker, etf }: { ticker: string; etf: string }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const { data, isPending, isError } = useQuery({
    queryKey: ['etf-description', etf],
    queryFn: () => getRelatedEtfDescription(ticker, etf),
    enabled: open,
    staleTime: (query) => !query.state.data?.fetched_at || query.state.data.stale
      ? 60_000 : 24 * 60 * 60 * 1000,
    retry: false,
  })

  // Once the provider confirms no description, omit the disclosure altogether.
  if (data && !data.description) return null

  return (
    <div className="text-muted-foreground mt-2 text-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded text-left outline-none focus-visible:ring-2"
      >
        <ChevronRight className={cn('size-3', open && 'rotate-90')} aria-hidden="true" />
        About this ETF
      </button>
      <div id={contentId} hidden={!open}>
        {isPending ? <p className="mt-2" role="status">Loading description…</p>
          : data?.description ? <>
            <p className="mt-2 leading-relaxed [overflow-wrap:anywhere]">{data.description}</p>
            <a href={data.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block underline underline-offset-2">
              {data.source_name}
            </a>
            {data.stale && <p className="mt-1">Cached description; refresh temporarily unavailable.</p>}
          </>
            : isError ? <p className="mt-2" role="status">Description temporarily unavailable.</p> : null}
      </div>
    </div>
  )
}

function EtfCard({ item, ticker, stock }: {
  item: RelatedEtfOut
  ticker: string
  stock: QuoteOut | undefined
}) {
  const pct = item.quote.change_pct
  const gap = relativeGap(stock, item.quote)
  const date = regularTradingDate(item.quote.regular_market_time)
  const today = regularTradingDate(new Date().toISOString())
  const duringSession = date === today && item.quote.market_session === 'regular'
  const Direction = pct == null || pct === 0 ? Minus : pct > 0 ? ArrowUp : ArrowDown
  return (
    <article className="bg-background min-w-0 rounded-lg border p-3" aria-label={`${item.ticker} related ETF`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{item.ticker}</span>
        <span className={cn('inline-flex items-center gap-1 text-lg font-semibold tabular-nums',
          pct == null || pct === 0 ? 'text-muted-foreground'
            : pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        )}>
          <Direction className="size-4" aria-hidden="true" />
          {formatSignedPct(pct)}
        </span>
      </div>
      <div className="text-muted-foreground mt-1 truncate text-xs" title={item.name ?? item.ticker}>
        {item.name ?? 'ETF name unavailable'}
      </div>
      <div className="text-muted-foreground mt-1 text-xs">
        {pct == null ? 'Quote unavailable' : duringSession ? 'Today · regular session'
          : date ? `Regular session · ${formatDate(date)}` : 'Quote date unavailable'}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t pt-2.5" aria-label={`${ticker} weight in ${item.ticker}`}>
        <span className="text-muted-foreground text-xs">{ticker} weight</span>
        <span className="text-sm font-semibold tabular-nums">{item.weight_pct.toFixed(2)}%</span>
      </div>
      <div
        role="meter"
        aria-label={`${ticker} allocation in ${item.ticker}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, item.weight_pct))}
        aria-valuetext={`${item.weight_pct.toFixed(2)}% of the ETF portfolio`}
        className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full"
      >
        <div
          className="h-full rounded-full bg-violet-500 transition-[width] duration-300 motion-reduce:transition-none dark:bg-violet-400"
          style={{ width: `${Math.min(100, Math.max(0, item.weight_pct))}%` }}
        />
      </div>
      <div className="text-muted-foreground mt-1.5 text-xs tabular-nums">
        {gap == null ? 'Comparison unavailable'
          : Math.abs(gap) < 0.005 ? `${ticker} in line · 0.00 pp`
            : `${ticker} ${gap > 0 ? 'ahead' : 'behind'} by ${Math.abs(gap).toFixed(2)} pp`}
      </div>
      <details className="text-muted-foreground mt-2 text-xs">
        <summary className="cursor-pointer">Holdings · {formatDate(item.holdings_date)}</summary>
        <p className="mt-1">{item.source === 'issuer' ? 'Issuer-reported holdings' : 'SEC Form N-PORT filing'}.
          {' '}Reported ownership may have changed.</p>
      </details>
      <EtfDescription ticker={ticker} etf={item.ticker} />
    </article>
  )
}

export function RelatedEtfs({ ticker }: { ticker: string }) {
  // Reset expansion and polling state immediately on ticker navigation.
  return <RelatedEtfsContent key={ticker} ticker={ticker} />
}

function RelatedEtfsContent({ ticker }: { ticker: string }) {
  const [expanded, setExpanded] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const busy = useRef(false)
  const queryClient = useQueryClient()
  const { data: stock } = useQuote(ticker)
  const { data, isPending, isError } = useQuery({
    queryKey: ['related-etfs', ticker],
    queryFn: () => getRelatedEtfs(ticker),
    staleTime: 60_000,
    retry: 1,
  })
  const items = data?.items.slice(0, expanded ? 20 : 5) ?? []
  const symbolsKey = items.map((item) => item.ticker).join(',')

  useEffect(() => {
    if (!symbolsKey) return
    let active = true
    const symbols = symbolsKey.split(',')
    async function refresh() {
      if (!active || busy.current || document.visibilityState === 'hidden') return
      busy.current = true
      try {
        const quotes = await refreshRelatedEtfQuotes(ticker, symbols)
        if (!active) return
        const bySymbol = new Map(quotes.map((quote) => [quote.ticker, quote]))
        queryClient.setQueryData<RelatedEtfsOut>(['related-etfs', ticker], (old) => old ? {
          ...old,
          items: old.items.map((item) => ({ ...item, quote: bySymbol.get(item.ticker) ?? item.quote })),
        } : old)
        setRefreshFailed(false)
      } catch {
        if (active) setRefreshFailed(true)
      } finally {
        busy.current = false
      }
    }
    void refresh()
    const interval = setInterval(() => { void refresh() }, 10_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [ticker, symbolsKey, queryClient])

  return (
    <section aria-label="Related ETFs" className="bg-muted/30 rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Related ETFs</h2>
          <p className="text-muted-foreground text-xs">ETFs holding {ticker}, ranked by stock weight</p>
        </div>
        {data && data.total_count > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Show less' : `Show more (${Math.min(data.total_count, 20)})`}
          </Button>
        )}
      </div>
      {isPending ? <p className="text-muted-foreground animate-pulse text-sm" role="status">Finding ETF holdings…</p>
        : isError || data?.status === 'unavailable'
          ? <p className="text-muted-foreground text-sm">ETF holdings coverage is currently unavailable.</p>
          : data?.status === 'empty'
            ? <p className="text-muted-foreground text-sm">No ETF holders found in the provider’s covered data.</p>
            : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {items.map((item) => <EtfCard key={item.ticker} item={item} ticker={ticker} stock={stock} />)}
            </div>}
      {data?.stale && <p className="text-muted-foreground mt-3 text-xs" role="status">
        Using cached holdings{data.fetched_at ? ` from ${formatDate(regularTradingDate(data.fetched_at))}` : ''}; refresh is temporarily unavailable.
      </p>}
      {refreshFailed && <p className="text-muted-foreground mt-2 text-xs" role="status">
        Quote refresh unavailable; showing last available quotes.
      </p>}
      {data && <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>Holdings: <a href={data.attribution_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {data.attribution_name}</a> · Daily quotes: Yahoo Finance</span>
        {data.total_count > 20 && <a href={data.attribution_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
          All {data.total_count} reported holders <ExternalLink className="size-3" aria-hidden="true" />
        </a>}
      </div>}
    </section>
  )
}
