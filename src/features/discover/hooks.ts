import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCustomTicker,
  archiveTicker,
  getNotableFilings,
  getSectorHeatmap,
  getTwitterBestStocks,
  getUniverse,
  hardDeleteTicker,
  searchUniverse,
  unarchiveTicker,
  refreshTwitterBestStocks,
  type UniverseParams,
} from '@/api/discover'

export function useNotableFilings() {
  return useQuery({ queryKey: ['discover', 'filings'], queryFn: getNotableFilings })
}

export function useTwitterBestStocks(limit: number) {
  return useQuery({
    queryKey: ['discover', 'twitter-best-stocks', limit],
    queryFn: () => getTwitterBestStocks(limit),
    refetchInterval: (query) => (query.state.data?.refresh_active ? 15_000 : 60_000),
  })
}

export function useRefreshTwitterBestStocks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: refreshTwitterBestStocks,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['discover', 'twitter-best-stocks'] }),
  })
}

export function useUniverse(params: UniverseParams) {
  return useQuery({
    queryKey: ['discover', 'universe', params],
    queryFn: () => getUniverse(params),
    // Keep showing the current page/rows while a sort/filter/page change
    // refetches, instead of unmounting the table for a full-page skeleton
    // on every click.
    placeholderData: keepPreviousData,
  })
}

export function useSectorHeatmap() {
  return useQuery({
    queryKey: ['discover', 'universe', 'sectors'],
    queryFn: getSectorHeatmap,
  })
}

// Debounced, server-side ticker/company-name search (the header "jump to
// ticker" box) — avoids ever shipping the full tracked universe (~916+
// tickers and growing) to the browser just to filter it client-side.
export function useUniverseTickerSearch(query: string, debounceMs = 200) {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), debounceMs)
    return () => clearTimeout(handle)
  }, [query, debounceMs])

  const trimmed = debounced.trim()
  return useQuery({
    queryKey: ['discover', 'universe', 'search', trimmed],
    queryFn: () => searchUniverse(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 60_000,
  })
}

export function useAddCustomTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticker, note }: { ticker: string; note?: string }) =>
      addCustomTicker(ticker, note),
    onSuccess: (_data, { ticker }) => {
      queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] })
      queryClient.invalidateQueries({ queryKey: ['universe-score', ticker] })
    },
  })
}

export function useArchiveTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => archiveTicker(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] }),
  })
}

export function useUnarchiveTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => unarchiveTicker(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] }),
  })
}

export function useHardDeleteTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => hardDeleteTicker(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] }),
  })
}
