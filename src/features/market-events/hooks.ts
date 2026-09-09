import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMarketEvents, refreshMarketEvents } from '@/api/market-events'

const marketEventsKey = (date?: string) => ['market-events', date ?? 'latest']

export function useMarketEvents(date?: string) {
  return useQuery({
    queryKey: marketEventsKey(date),
    queryFn: () => getMarketEvents(date),
    // Underlying daily run lands at a fixed early-morning time (06:30 ET),
    // not continuously -- a slow background refresh is enough to pick it
    // up, same convention as useGoogleFinanceMarketPicks.
    refetchInterval: 5 * 60_000,
  })
}

export function useRefreshMarketEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: refreshMarketEvents,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['market-events'] }),
  })
}
