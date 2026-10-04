import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { completedBacktest } from '@/features/ticker-detail/pairs/test-fixtures'
import { getPairBacktest, runPairBacktest } from './pair-backtest'

beforeEach(() => vi.restoreAllMocks())

test('reads the saved backtest of the ordered pair with normalized tickers', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  const saved = await getPairBacktest(' wdc ', 'stx')

  expect(get).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/backtest')
  expect(saved).toBeNull()
})

test('keeps the selected stock first and the candidate second', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  await getPairBacktest('STX', 'WDC')

  expect(get).toHaveBeenCalledWith('/v1/stocks/STX/pairs/WDC/backtest')
})

test('encodes each ticker as its own path segment and spells share classes with a dot', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)

  await getPairBacktest('a&b', 'c/d')
  await getPairBacktest('brk-b', 'bf b')

  expect(get).toHaveBeenNthCalledWith(1, '/v1/stocks/A%26B/pairs/C%2FD/backtest')
  expect(get).toHaveBeenNthCalledWith(2, '/v1/stocks/BRK.B/pairs/BF.B/backtest')
})

test('a default backtest posts without forcing a new run', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(completedBacktest as never)

  const report = await runPairBacktest('wdc', 'stx')

  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/backtest')
  expect(report).toEqual(completedBacktest)
})

test('a forced refresh asks the server to replay with a new cutoff', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(completedBacktest as never)

  await runPairBacktest('WDC', 'STX', true)

  expect(post).toHaveBeenCalledWith('/v1/stocks/WDC/pairs/STX/backtest?force_refresh=true')
})
