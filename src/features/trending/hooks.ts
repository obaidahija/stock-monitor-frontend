import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getTrendingLeaderboard,
  getTrendingSectors,
  getTrendingSummary,
  type TrendingLeaderboardParams,
} from '@/api/trending'

export function useTrendingSummary(limit = 10) {
  return useQuery({
    queryKey: ['trending', 'summary', limit],
    queryFn: () => getTrendingSummary(limit),
    // Underlying daily runs land at fixed morning times, not continuously --
    // a slow background refresh is enough to pick those up without
    // hammering the endpoint.
    refetchInterval: 5 * 60_000,
  })
}

export function useTrendingLeaderboard(params: TrendingLeaderboardParams) {
  return useQuery({
    queryKey: ['trending', 'leaderboard', params],
    queryFn: () => getTrendingLeaderboard(params),
    placeholderData: keepPreviousData,
  })
}

export function useTrendingSectors() {
  return useQuery({
    queryKey: ['trending', 'sectors'],
    queryFn: getTrendingSectors,
    refetchInterval: 5 * 60_000,
  })
}
