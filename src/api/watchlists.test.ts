import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { createAiSetups, getSetupWindowPreview, updateWatchlistSetup } from './watchlists'

beforeEach(() => vi.restoreAllMocks())

test('previews a swing window by session count only', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getSetupWindowPreview(3)
  expect(get).toHaveBeenCalledWith('/v1/watchlists/setup-window?horizon_sessions=3')
})

test('sends a swing AI save with its session count and no expiry date', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue([] as never)
  await createAiSetups({
    ticker: 'NVDA',
    snapshot_id: 10,
    watchlist_ids: [1, 2],
    horizon: 'swing',
    horizon_sessions: 5,
  })
  expect(post).toHaveBeenCalledWith('/v1/watchlists/setups/ai', {
    ticker: 'NVDA',
    snapshot_id: 10,
    watchlist_ids: [1, 2],
    horizon: 'swing',
    horizon_sessions: 5,
  })
})

test('patches only the fields the caller changed', async () => {
  const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({} as never)
  await updateWatchlistSetup(20, { horizon_sessions: 7 })
  expect(patch).toHaveBeenCalledWith('/v1/watchlists/setups/20', { horizon_sessions: 7 })
})
