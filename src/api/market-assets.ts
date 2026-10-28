import { apiClient } from '@/lib/api-client'
import type { MarketAssetsOut } from '@/types/api'

/** Reads the saved Yahoo capture; never requests new provider quotes. */
export function getMarketAssets() {
  return apiClient.get<MarketAssetsOut>('/v1/market-assets')
}
