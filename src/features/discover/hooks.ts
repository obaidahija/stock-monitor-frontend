import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addManualTicker,
  getGappers,
  getNotableFilings,
  getTrending,
  getUnusualVolume,
  getUniverse,
  removeManualTicker,
  type UniverseParams,
} from '@/api/discover'

export function useGappers(minGapPct: number) {
  return useQuery({ queryKey: ['discover', 'gappers', minGapPct], queryFn: () => getGappers(minGapPct) })
}

export function useUnusualVolume(minRatio: number) {
  return useQuery({
    queryKey: ['discover', 'unusual-volume', minRatio],
    queryFn: () => getUnusualVolume(minRatio),
  })
}

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
