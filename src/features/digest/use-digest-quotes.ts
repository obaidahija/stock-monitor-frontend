import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { focusManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { DigestQuoteOut } from '@/types/api'

const COALESCE_MS = 200
const REFRESH_MS = 30_000
type SavedQuote = { quote: DigestQuoteOut; attemptedAt: number }
const QUOTE_CACHE_KEY = ['digest-quote-cache'] as const
const requestsByClient = new WeakMap<QueryClient, Map<string, symbol>>()

function subscribeToFocus(onChange: () => void) {
  return focusManager.subscribe(onChange)
}

function quoteTime(quote: DigestQuoteOut): number {
  return Date.parse(quote.session_time ?? quote.regular_market_time ?? '') || 0
}

function unavailable(ticker: string): DigestQuoteOut {
  return { ticker, price: null, session_price: null, change_amount: null, change_pct: null,
    session_change_amount: null, session_change_pct: null, regular_market_time: null,
    session_time: null, market_session: null }
}

/** Cache symbols independently: a changed viewport only fetches missing/stale quotes. */
export function useDigestQuotes(symbols: string[]) {
  const queryClient = useQueryClient()
  const visibleKey = symbols.join(',')
  const [settledKey, setSettledKey] = useState('')
  // This disabled observer keeps saved prices reactive and alive across provider
  // remounts. The separate batch query is the only source of network requests.
  const { data: saved } = useQuery({
    queryKey: QUOTE_CACHE_KEY,
    queryFn: () => queryClient.getQueryData<Map<string, SavedQuote>>(QUOTE_CACHE_KEY) ?? new Map<string, SavedQuote>(),
    initialData: () => new Map<string, SavedQuote>(),
    enabled: false,
    staleTime: Infinity,
  })
  const inFlight = useMemo(() => {
    let requests = requestsByClient.get(queryClient)
    if (!requests) {
      requests = new Map<string, symbol>()
      requestsByClient.set(queryClient, requests)
    }
    return requests
  }, [queryClient])
  const focused = useSyncExternalStore(subscribeToFocus, () => focusManager.isFocused())
  useEffect(() => {
    if (!visibleKey) {
      setSettledKey('')
      return
    }
    const timer = window.setTimeout(() => setSettledKey(visibleKey), COALESCE_MS)
    return () => window.clearTimeout(timer)
  }, [visibleKey])
  const settledSymbols = settledKey ? settledKey.split(',') : []
  useQuery({
    queryKey: ['digest-live-quotes', settledKey],
    enabled: Boolean(settledKey) && settledKey === visibleKey && focused,
    staleTime: 0,
    retry: false,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      if (query.state.fetchStatus !== 'idle') return false
      const cache = queryClient.getQueryData<Map<string, SavedQuote>>(QUOTE_CACHE_KEY)
      const waits = settledSymbols.filter((ticker) => !inFlight.has(ticker))
        .map((ticker) => Math.max(1, (cache?.get(ticker)?.attemptedAt ?? 0) + REFRESH_MS - Date.now()))
      return waits.length ? Math.min(REFRESH_MS, ...waits) : REFRESH_MS
    },
    queryFn: async () => {
      const now = Date.now()
      const cache = queryClient.getQueryData<Map<string, SavedQuote>>(QUOTE_CACHE_KEY)
      const requested = settledSymbols.filter((ticker) => !inFlight.has(ticker)
        && (!cache?.has(ticker) || now - cache.get(ticker)!.attemptedAt >= REFRESH_MS))
      if (requested.length === 0) return []
      const requestId = Symbol()
      for (const ticker of requested) inFlight.set(ticker, requestId)

      function save(incoming: DigestQuoteOut[], failure?: string) {
        const returned = new Map(incoming.map((quote) => [quote.ticker.trim().toUpperCase(), quote]))
        const next = new Map(queryClient.getQueryData<Map<string, SavedQuote>>(QUOTE_CACHE_KEY))
        for (const ticker of requested) {
          if (inFlight.get(ticker) !== requestId) continue
          const previous = next.get(ticker)?.quote
          const received = returned.get(ticker)
          const hasPrice = received && (received.session_price ?? received.price) != null
          const status = received?.refresh_status ?? (hasPrice ? 'fresh' : 'unavailable')
          const error = failure ?? (status === 'fresh' ? null
            : received?.refresh_error ?? 'Live quote refresh unavailable')
          const selected = hasPrice && (!previous || quoteTime(received) >= quoteTime(previous))
            ? received : previous ?? unavailable(ticker)
          const quote: DigestQuoteOut = { ...selected,
            refresh_status: status === 'unavailable' && (selected.session_price ?? selected.price) != null ? 'cached' : status,
            refresh_error: error }
          next.set(ticker, { quote, attemptedAt: Date.now() })
        }
        queryClient.setQueryData(QUOTE_CACHE_KEY, next)
      }

      try {
        const result = await apiClient.post<DigestQuoteOut[]>('/v1/digest/quotes/refresh', requested)
        if (!Array.isArray(result)) throw new Error('Quote refresh returned no data')
        save(result)
        return result
      } catch (error) {
        save([], error instanceof Error ? error.message : 'Quote refresh failed')
        throw error
      } finally {
        for (const ticker of requested) {
          if (inFlight.get(ticker) === requestId) inFlight.delete(ticker)
        }
      }
    },
  })
  return useMemo(() => new Map([...saved].map(([ticker, entry]) => [ticker, entry.quote])), [saved])
}
