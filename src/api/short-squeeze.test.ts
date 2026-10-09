import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { getShortSqueezeDetail, getShortSqueezes } from './short-squeeze'

afterEach(() => vi.restoreAllMocks())

describe('getShortSqueezes', () => {
  it('sends the status, sort and pagination it was given, exactly', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [] } as never)

    await getShortSqueezes({ status: 'incomplete', sort: 'days_to_cover', page: 3, pageSize: 10 })

    expect(get).toHaveBeenCalledWith(
      '/v1/discover/short-squeezes?status=incomplete&sort=days_to_cover&page=3&page_size=10',
    )
  })

  it('asks for matches by move on the first page by default', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [] } as never)

    await getShortSqueezes({ status: 'matched', sort: 'move', page: 1, pageSize: 10 })

    expect(get).toHaveBeenCalledWith(
      '/v1/discover/short-squeezes?status=matched&sort=move&page=1&page_size=10',
    )
  })
})

describe('getShortSqueezeDetail', () => {
  it('reads one frozen evaluation by its id', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)

    await getShortSqueezeDetail(42)

    expect(get).toHaveBeenCalledWith('/v1/discover/short-squeezes/42')
  })
})
