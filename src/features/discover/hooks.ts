import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addManualTicker,
  archiveTicker,
  getNotableFilings,
  getTrending,
  getUniverse,
  hardDeleteTicker,
  removeManualTicker,
  searchUniverse,
  unarchiveTicker,
  type UniverseParams,
} from '@/api/discover'

export function useNotableFilings() {
  return useQuery({ queryKey: ['discover', 'filings'], queryFn: getNotableFilings })
}

export function useTrending(limit: number) {
  return useQuery({ queryKey: ['discover', 'trending', limit], queryFn: () => getTrending(limit) })
}

export function useUniverse(params: UniverseParams) {
  return useQuery({
    queryKey: ['discover', 'universe', params],
    queryFn: () => getUniverse(params),
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

export function useAddManualTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticker, note }: { ticker: string; note?: string }) =>
      addManualTicker(ticker, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] }),
  })
}

export function useRemoveManualTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => removeManualTicker(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] }),
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
