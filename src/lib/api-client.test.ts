import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from './api-client'

afterEach(() => vi.unstubAllGlobals())

test('a GET hands its abort signal to fetch so a superseded read stops on the wire', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()

  await apiClient.get('/v1/stocks/AAA/quote', controller.signal)

  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
})
