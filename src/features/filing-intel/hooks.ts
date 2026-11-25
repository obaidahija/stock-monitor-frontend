import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  analyzeFilings,
  getFiling,
  getFilingEpisodes,
  getRecentFilings,
  getUpcomingFilings,
  getCurrentPrices,
  getFilingChart,
} from '@/api/filing-intel'

export function useUpcomingFilings(days: number, form?: string) {
  return useQuery({
    queryKey: ['filing-intel', 'upcoming', days, form ?? 'all'],
    queryFn: () => getUpcomingFilings({ days, form, include_filed: true }),
    // Rows flip to "filed" as the 15 s watcher matches arrivals.
    refetchInterval: 60_000,
  })
}

export const RECENT_PAGE_SIZE = 500

export function useRecentFilings(params: {
  hours: number
  ticker?: string
  topic?: string
  form?: string
  coverage?: string
  kind?: string
  signal?: string
}) {
  // Pages of RECENT_PAGE_SIZE, newest first; the next page starts before the oldest shown.
  return useInfiniteQuery({
    queryKey: ['filing-intel', 'recent', params],
    queryFn: ({ pageParam }) => getRecentFilings({ ...params, before: pageParam, limit: RECENT_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === RECENT_PAGE_SIZE ? (last[last.length - 1].accepted_at ?? undefined) : undefined,
    refetchInterval: 30_000,
  })
}

export function useFiling(accession: string | null) {
  return useQuery({
    queryKey: ['filing-intel', 'filing', accession],
    queryFn: () => getFiling(accession as string),
    enabled: accession !== null,
  })
}

export function useFilingEpisodes(ticker: string | null) {
  return useQuery({
    queryKey: ['filing-intel', 'episodes', ticker],
    queryFn: () => getFilingEpisodes(ticker as string),
    enabled: ticker !== null,
  })
}

export function useAnalyzeFilings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: analyzeFilings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['filing-intel', 'recent'] }),
  })
}

/** Current price per ticker (the backend caches a minute); keyed by ticker. */
/** The prices endpoint answers at most this many tickers per request. */
export const PRICE_BATCH = 200

export function useCurrentPrices(tickers: string[]) {
  const unique = [...new Set(tickers.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['filing-intel', 'prices', unique],
    // A 500-row page holds more tickers than one request answers: ask in batches and merge,
    // or every ticker after the 200th (alphabetically) showed no "Now" price.
    queryFn: async () => {
      const batches = []
      for (let i = 0; i < unique.length; i += PRICE_BATCH) batches.push(unique.slice(i, i + PRICE_BATCH))
      return (await Promise.all(batches.map((batch) => getCurrentPrices(batch)))).flat()
    },
    enabled: unique.length > 0,
    refetchInterval: 60_000,
    select: (quotes) => new Map(quotes.map((q) => [q.ticker, q])),
  })
}

/** Prices around a filing; "auto" is 5-minute bars for recent filings, daily closes otherwise. */
export function useFilingChart(accession: string | null, interval: 'auto' | '5m' | '1d') {
  return useQuery({
    queryKey: ['filing-intel', 'chart', accession, interval],
    queryFn: () => getFilingChart(accession as string, interval),
    enabled: accession !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
