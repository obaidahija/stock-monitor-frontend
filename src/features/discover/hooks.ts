import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addManualTicker,
  getNotableFilings,
  getTrending,
  getUniverse,
  removeManualTicker,
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

// Full tracked-universe list, kept warm client-side so ticker search can
// filter as-you-type without hitting the API on every keystroke.
export function useUniverseSearchIndex() {
  return useQuery({
    queryKey: ['discover', 'universe', 'search-index'],
    queryFn: () => getUniverse({ limit: 508, sort: 'ticker', order: 'asc' }),
    staleTime: 5 * 60_000,
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
