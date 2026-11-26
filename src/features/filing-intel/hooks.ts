import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  analyzeFilings,
  getFiling,
  getFilingEpisodes,
  getRecentFilings,
  getUpcomingFilings,
  getCurrentPrices,
  getFilingChart,
  getFilingPeers,
} from '@/api/filing-intel'

export function useUpcomingFilings(days: number, form?: string) {
  return useQuery({
    queryKey: ['filing-intel', 'upcoming', days, form ?? 'all'],
    queryFn: () => getUpcomingFilings({ days, form, include_filed: true }),
    // Rows flip to "filed" as the 15 s watcher matches arrivals.
    refetchInterval: 60_000,
  })
}

export const RECENT_PAGE_SIZE = 20

export function useRecentFilings(params: {
  hours: number
  page: number
  ticker?: string
  topic?: string
  form?: string
  coverage?: string
  kind?: string
  signal?: string
}) {
  return useQuery({
    queryKey: ['filing-intel', 'recent', params],
    queryFn: () => getRecentFilings({ ...params, limit: RECENT_PAGE_SIZE }),
    refetchInterval: 30_000,
    staleTime: 30_000,
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
    // Batch large ticker lists so every requested ticker receives a price.
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

/** Same-industry filings from the 30 days before this one, with their labels and moves. */
export function useFilingPeers(accession: string | null) {
  return useQuery({
    queryKey: ['filing-intel', 'peers', accession],
    queryFn: () => getFilingPeers(accession as string),
    enabled: accession !== null,
    staleTime: 10 * 60_000,
  })
}
