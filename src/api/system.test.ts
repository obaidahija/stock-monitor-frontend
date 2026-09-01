import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { getSignalPerformance } from './system'

beforeEach(() => vi.restoreAllMocks())

test('requests signal performance for the given horizon', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getSignalPerformance(20)
  expect(get).toHaveBeenCalledWith('/v1/signal-performance?horizon=20')
})

test('defaults to the short horizon', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getSignalPerformance(5)
  expect(get).toHaveBeenCalledWith('/v1/signal-performance?horizon=5')
})
