import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getGoogleFinanceMarketPicks,
  refreshGoogleFinanceMarketPicks,
} from '@/api/google-finance-picks'

const QUERY_KEY = ['google-finance-market-picks']

export function useGoogleFinanceMarketPicks() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getGoogleFinanceMarketPicks,
    // Underlying daily run lands at a fixed early-morning time, not
    // continuously -- a slow background refresh is enough to pick it up,
    // same convention as useTrendingSummary.
    refetchInterval: 5 * 60_000,
  })
}

export function useRefreshGoogleFinanceMarketPicks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: refreshGoogleFinanceMarketPicks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
