import { apiClient } from '@/lib/api-client'
import type { MarketBriefingOut, MarketBriefingRefreshOut } from '@/types/api'

export const getMarketBriefing = () => apiClient.get<MarketBriefingOut>('/v1/market-briefing')
export const refreshMarketBriefing = () =>
  apiClient.post<MarketBriefingRefreshOut>('/v1/market-briefing/refresh')
