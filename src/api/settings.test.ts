import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import {
  getSettings,
  getSettingsCategory,
  resetSettingsCategory,
  updateSettingsCategory,
} from './settings'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

describe('settings api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all settings', async () => {
    await getSettings()
    expect(apiClient.get).toHaveBeenCalledWith('/v1/settings')
  })

  it('fetches one category', async () => {
    await getSettingsCategory('discovery')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/settings/discovery')
  })

  it('sends values wrapped in a values object', async () => {
    await updateSettingsCategory('discovery', { mention_spike_min_count: 11 })
    expect(apiClient.put).toHaveBeenCalledWith('/v1/settings/discovery', {
      values: { mention_spike_min_count: 11 },
    })
  })

  it('posts a reset', async () => {
    await resetSettingsCategory('discovery')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/settings/discovery/reset')
  })
})
