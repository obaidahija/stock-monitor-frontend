import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getUniverse } from './discover'
import { apiClient } from '@/lib/api-client'

describe('getUniverse short-interest and peer params', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getWithResponse').mockResolvedValue({
      data: [],
      response: new Response(null, { headers: { 'X-Total-Count': '0' } }),
    } as never)
  })

  it('sends min_short_pct and max_float_shares', async () => {
    await getUniverse({ minShortPct: 15, maxFloatShares: 75_000_000 })

    const url = vi.mocked(apiClient.getWithResponse).mock.calls[0][0] as string
    expect(url).toContain('min_short_pct=15')
    expect(url).toContain('max_float_shares=75000000')
  })

  it('omits both when they are not set', async () => {
    await getUniverse({})

    const url = vi.mocked(apiClient.getWithResponse).mock.calls[0][0] as string
    expect(url).not.toContain('min_short_pct')
    expect(url).not.toContain('max_float_shares')
  })

  it('accepts the new sort fields', async () => {
    await getUniverse({ sort: 'short_percent_of_float', order: 'desc' })

    const url = vi.mocked(apiClient.getWithResponse).mock.calls[0][0] as string
    expect(url).toContain('sort=short_percent_of_float')
  })

  it('accepts the peer percentile sort fields', async () => {
    await getUniverse({ sort: 'sector_score_percentile' })

    const url = vi.mocked(apiClient.getWithResponse).mock.calls[0][0] as string
    expect(url).toContain('sort=sector_score_percentile')
  })
})
