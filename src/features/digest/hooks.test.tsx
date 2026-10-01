import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { dismissDigestItem, getIntradayDigest, getMorningDigest } from '@/api/digest'
import { runJob } from '@/api/system'
import type { DigestOut } from '@/types/api'
import { useBuildDigest, useDigest, useDismissDigestItem } from './hooks'

vi.mock('@/api/digest', () => ({
  getMorningDigest: vi.fn(),
  getIntradayDigest: vi.fn(),
  getTickerDigest: vi.fn(),
  dismissDigestItem: vi.fn(),
  sendMorningDigest: vi.fn(),
}))
vi.mock('@/api/system', () => ({ runJob: vi.fn() }))

function digest(edition: string, ticker: string): DigestOut {
  return {
    digest_date: '2026-09-30',
    generated_at: '2026-09-30T13:05:00Z',
    edition,
    snapshot_id: 1,
    capture_completed_at: '2026-09-30T13:06:00Z',
    preliminary: false,
    payload: { digest_date: '2026-09-30', generated_at: '2026-09-30T13:05:00Z', items: [
      { ticker, tier: 3, reasons: [], stages: [], premarket: null, premarket_gap_pct: null,
        volume_ratio: null, pct_from_12wk_avg: null, recent_pattern: null, top_filing: null,
        top_earnings: null, news_count_24h: 0, headline_snippets: [], sentiment: null },
    ] },
  }
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, wrapper }
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

test('each edition and date has its own cache entry', async () => {
  vi.mocked(getMorningDigest).mockResolvedValue(digest('late', 'MORN'))
  vi.mocked(getIntradayDigest).mockResolvedValue(digest('intraday', 'INTRA'))
  const { client, wrapper } = setup()

  const morning = renderHook(() => useDigest('morning'), { wrapper })
  const intraday = renderHook(() => useDigest('intraday'), { wrapper })
  const dated = renderHook(() => useDigest('morning', '2026-09-29'), { wrapper })

  await waitFor(() => expect(morning.result.current.data?.edition).toBe('late'))
  await waitFor(() => expect(intraday.result.current.data?.edition).toBe('intraday'))
  await waitFor(() => expect(dated.result.current.isSuccess).toBe(true))
  expect(client.getQueryData(['digest', 'morning', 'today'])).toEqual(digest('late', 'MORN'))
  expect(client.getQueryData(['digest', 'intraday', 'today'])).toEqual(digest('intraday', 'INTRA'))
  expect(getMorningDigest).toHaveBeenCalledWith('2026-09-29')
  expect(getIntradayDigest).toHaveBeenCalledWith(undefined)
})

test('a build refreshes the intraday view and leaves the morning cache alone', async () => {
  vi.mocked(runJob).mockResolvedValue({} as never)
  const { client, wrapper } = setup()
  client.setQueryData(['digest', 'morning', 'today'], digest('late', 'MORN'))
  client.setQueryData(['digest', 'intraday', 'today'], digest('intraday', 'OLD'))

  const build = renderHook(() => useBuildDigest(), { wrapper })
  await act(() => build.result.current.mutateAsync())

  expect(runJob).toHaveBeenCalledWith('digest_build')
  expect(client.getQueryState(['digest', 'intraday', 'today'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['digest', 'morning', 'today'])?.isInvalidated).toBe(false)
})

test('a dismissal refreshes both editions', async () => {
  vi.mocked(dismissDigestItem).mockResolvedValue(undefined)
  const { client, wrapper } = setup()
  client.setQueryData(['digest', 'morning', 'today'], digest('late', 'MORN'))
  client.setQueryData(['digest', 'intraday', 'today'], digest('intraday', 'INTRA'))

  const dismiss = renderHook(() => useDismissDigestItem(), { wrapper })
  await act(() => dismiss.result.current.mutateAsync('MORN'))

  expect(client.getQueryState(['digest', 'morning', 'today'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['digest', 'intraday', 'today'])?.isInvalidated).toBe(true)
})
