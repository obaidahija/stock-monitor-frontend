import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMarketBriefing, refreshMarketBriefing } from '@/api/market-briefing'

export function useMarketBriefing() {
  return useQuery({
    queryKey: ['market-briefing'],
    queryFn: getMarketBriefing,
    refetchInterval: (query) => query.state.data?.refresh_active ? 2000 : 60_000,
  })
}

export function useRefreshMarketBriefing() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: refreshMarketBriefing,
    onSuccess: () => client.invalidateQueries({ queryKey: ['market-briefing'] }),
  })
}
