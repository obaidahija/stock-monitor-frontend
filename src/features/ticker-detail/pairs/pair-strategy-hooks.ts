import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { analyzePairStrategy, getPairStrategy } from '@/api/pair-strategy'
import { pairTicker } from '@/api/stock-pairs'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { isOlderPairReport } from './pair-report-version'

export function pairStrategyKey(ticker: string, candidateTicker: string) {
  return ['pair-strategy', pairTicker(ticker), pairTicker(candidateTicker)] as const
}

export function usePairStrategy(ticker: string, candidateTicker: string, enabled: boolean) {
  return useQuery({
    queryKey: pairStrategyKey(ticker, candidateTicker),
    // GET only reads the saved analysis. Calculating requires an explicit POST.
    queryFn: () => getPairStrategy(pairTicker(ticker), pairTicker(candidateTicker)),
    enabled,
    // A failed read is shown with a Retry loading action instead of repeating itself.
    retry: false,
  })
}

export function useAnalyzePairStrategy(ticker: string, candidateTicker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forceRefresh: boolean) =>
      analyzePairStrategy(pairTicker(ticker), pairTicker(candidateTicker), forceRefresh),
    // An analysis fetches prices and recalculates; never repeat it without the user.
    retry: false,
    onSuccess: async (result) => {
      // Keyed by the response's own ordered pair, so an analysis finishing after
      // navigation is saved under that pair; a late saved read is cancelled first so
      // it cannot overwrite the new result.
      const key = pairStrategyKey(result.ticker, result.candidate_ticker)
      await queryClient.cancelQueries({ queryKey: key })
      // Navigation can allow a newer read or refresh to finish before this response.
      queryClient.setQueryData<PairStrategyOut | null>(key, (current) =>
        isOlderPairReport(result, current) ? current : result,
      )
    },
  })
}
