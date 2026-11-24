import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  analyzeFilings,
  getFiling,
  getFilingEpisodes,
  getRecentFilings,
  getUpcomingFilings,
  getCurrentPrices,
} from '@/api/filing-intel'

export function useUpcomingFilings(days: number, form?: string) {
  return useQuery({
    queryKey: ['filing-intel', 'upcoming', days, form ?? 'all'],
    queryFn: () => getUpcomingFilings({ days, form, include_filed: true }),
    // Rows flip to "filed" as the 15 s watcher matches arrivals.
    refetchInterval: 60_000,
  })
}

export function useRecentFilings(params: {
  hours: number
  ticker?: string
  topic?: string
  form?: string
  coverage?: string
  kind?: string
}) {
  return useQuery({
    queryKey: ['filing-intel', 'recent', params],
    queryFn: () => getRecentFilings({ ...params, limit: 200 }),
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
export function useCurrentPrices(tickers: string[]) {
  const unique = [...new Set(tickers.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['filing-intel', 'prices', unique],
    queryFn: () => getCurrentPrices(unique),
    enabled: unique.length > 0,
    refetchInterval: 60_000,
    select: (quotes) => new Map(quotes.map((q) => [q.ticker, q])),
  })
}
