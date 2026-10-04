import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPairBacktest, runPairBacktest } from '@/api/pair-backtest'
import { pairTicker } from '@/api/stock-pairs'
import type { PairBacktestOut } from '@/types/pair-backtest'
import { isOlderPairReport } from './pair-report-version'

export function pairBacktestKey(ticker: string, candidateTicker: string) {
  return ['pair-backtest', pairTicker(ticker), pairTicker(candidateTicker)] as const
}

export function usePairBacktest(ticker: string, candidateTicker: string, enabled: boolean) {
  return useQuery({
    queryKey: pairBacktestKey(ticker, candidateTicker),
    // GET only reads the saved backtest. Running one requires an explicit POST.
    queryFn: () => getPairBacktest(pairTicker(ticker), pairTicker(candidateTicker)),
    enabled,
    // A failed read is shown with a Retry loading action instead of repeating itself.
    retry: false,
  })
}

export function useRunPairBacktest(ticker: string, candidateTicker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forceRefresh: boolean) =>
      runPairBacktest(pairTicker(ticker), pairTicker(candidateTicker), forceRefresh),
    // A backtest fetches five years of prices and replays a year; never repeat it
    // without the user.
    retry: false,
    onSuccess: async (result) => {
      // Keyed by the response's own ordered pair, so a backtest finishing after
      // navigation is saved under that pair; a late saved read is cancelled first so
      // it cannot overwrite the new result.
      const key = pairBacktestKey(result.ticker, result.candidate_ticker)
      await queryClient.cancelQueries({ queryKey: key })
      // Navigation can allow a newer read or refresh to finish before this response.
      queryClient.setQueryData<PairBacktestOut | null>(key, (current) =>
        isOlderPairReport(result, current) ? current : result,
      )
    },
  })
}
