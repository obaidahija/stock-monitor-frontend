import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { getGoogleFinanceMarketPicks, refreshGoogleFinanceMarketPicks } from './google-finance-picks'

beforeEach(() => vi.restoreAllMocks())

test('fetches the google finance market picks snapshot', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)

  await getGoogleFinanceMarketPicks()

  expect(get).toHaveBeenCalledWith('/v1/discover/google-finance-market-picks')
})

test('posts a refresh request with no body', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)

  await refreshGoogleFinanceMarketPicks()

  expect(post).toHaveBeenCalledWith('/v1/discover/google-finance-market-picks/refresh')
})
