import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { supportedStrategy } from '@/features/ticker-detail/pairs/test-fixtures'
import { analyzePairStrategy, getPairStrategy } from './pair-strategy'

beforeEach(() => vi.restoreAllMocks())

test('reads the saved analysis of the ordered pair with normalized tickers', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  const saved = await getPairStrategy(' wdc ', 'stx')

  expect(get).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/strategy')
  expect(saved).toBeNull()
})

test('keeps the selected stock first and the candidate second', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  await getPairStrategy('STX', 'WDC')

  expect(get).toHaveBeenCalledWith('/v1/stocks/STX/pairs/WDC/strategy')
})

test('encodes each ticker as its own path segment', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  await getPairStrategy('a&b', 'c/d')

  expect(get).toHaveBeenCalledWith('/v1/stocks/A%26B/pairs/C%2FD/strategy')
})

test('share classes use the dot spelling the server saves under', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  await getPairStrategy('brk-b', 'bf b')

  expect(get).toHaveBeenCalledWith('/v1/stocks/BRK.B/pairs/BF.B/strategy')
})

test('a default analysis posts without forcing a recalculation', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(supportedStrategy as never)

  const report = await analyzePairStrategy('wdc', 'stx')

  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/strategy')
  expect(report).toEqual(supportedStrategy)
})

test('a forced refresh asks the server to recalculate', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(supportedStrategy as never)

  await analyzePairStrategy('WDC', 'STX', true)

  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/strategy?force_refresh=true')
})
