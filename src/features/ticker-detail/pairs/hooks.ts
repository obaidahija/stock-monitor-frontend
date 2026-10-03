import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getStockPairs, pairTicker, refreshStockPairs } from '@/api/stock-pairs'

function stockPairsKey(ticker: string) {
  return ['stock-pairs', pairTicker(ticker)] as const
}

export function useStockPairs(ticker: string) {
  return useQuery({
    queryKey: stockPairsKey(ticker),
    // GET only reads the saved report. The first search requires an explicit POST.
    queryFn: () => getStockPairs(pairTicker(ticker)),
  })
}

export function useRefreshStockPairs(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forceRefresh: boolean) => refreshStockPairs(ticker, forceRefresh),
    // A search asks Google and Yahoo again; never repeat it without the user.
    retry: false,
    onSuccess: async (result) => {
      // Keyed by the response, so a search that finishes after navigation is saved
      // under its own ticker; a late saved read is cancelled so it cannot overwrite it.
      const key = stockPairsKey(result.ticker)
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData(key, result)
    },
  })
}
