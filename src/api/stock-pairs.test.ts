import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { getStockPairs, refreshStockPairs } from './stock-pairs'

beforeEach(() => vi.restoreAllMocks())

test('reads the saved pair report for a normalized ticker', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)
  await getStockPairs(' wdc ')
  expect(get).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/research')
})

test('encodes the ticker in the path', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)
  await getStockPairs('a&b')
  expect(get).toHaveBeenCalledWith('/v1/stocks/A%26B/pairs/research')
})

test('a default search posts without forcing a refresh', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await refreshStockPairs('wdc')
  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/research')
})

test('a forced refresh asks the server to repeat the research', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await refreshStockPairs('WDC', true)
  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/research?force_refresh=true')
})

test('share classes use the dot spelling the server saves under', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)
  await getStockPairs('brk-b')
  expect(get).toHaveBeenCalledWith('/v1/stocks/BRK.B/pairs/research')
})
