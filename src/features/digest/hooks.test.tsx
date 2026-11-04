import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { dismissDigestItem, getIntradayDigest, getMorningDigest, restoreDigestItem } from '@/api/digest'
import { runJob } from '@/api/system'
import type { DigestOut } from '@/types/api'
import { useBuildDigest, useDigest, useDismissDigestItem, useRestoreDigestItem } from './hooks'

vi.mock('@/api/digest', () => ({
  getMorningDigest: vi.fn(),
  getIntradayDigest: vi.fn(),
  getTickerDigest: vi.fn(),
  dismissDigestItem: vi.fn(),
  sendMorningDigest: vi.fn(),
  getDigestDismissals: vi.fn(),
  restoreDigestItem: vi.fn(),
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

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

test('each edition and date has its own cache entry', async () => {
  vi.mocked(getMorningDigest).mockResolvedValue(digest('late', 'MORN'))
  vi.mocked(getIntradayDigest).mockResolvedValue(digest('intraday', 'INTRA'))
  const { client, wrapper } = setup()

  const morning = renderHook(() => useDigest('morning', '2026-09-30'), { wrapper })
  const intraday = renderHook(() => useDigest('intraday', '2026-09-30'), { wrapper })
  const dated = renderHook(() => useDigest('morning', '2026-09-29'), { wrapper })

  await waitFor(() => expect(morning.result.current.data?.edition).toBe('late'))
  await waitFor(() => expect(intraday.result.current.data?.edition).toBe('intraday'))
  await waitFor(() => expect(dated.result.current.isSuccess).toBe(true))
  expect(client.getQueryData(['digest', 'morning', '2026-09-30'])).toEqual(digest('late', 'MORN'))
  expect(client.getQueryData(['digest', 'intraday', '2026-09-30'])).toEqual(digest('intraday', 'INTRA'))
  expect(getMorningDigest).toHaveBeenCalledWith('2026-09-29')
  expect(getIntradayDigest).toHaveBeenCalledWith('2026-09-30')
})

test('a build refreshes the intraday view and leaves the morning cache alone', async () => {
  vi.mocked(runJob).mockResolvedValue({ job_run_id: 1, status: 'success', detail: { snapshot_id: 2 }, error: null })
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

test.each([
  { status: 'failed', error: 'Calendar unavailable', detail: null, message: 'Calendar unavailable' },
  { status: 'skipped', error: null, detail: { reason: 'already running' }, message: 'already running' },
])('a $status build rejects without invalidating an existing edition', async ({ status, error, detail, message }) => {
  vi.mocked(runJob).mockResolvedValue({ job_run_id: 1, status, error, detail })
  const { client, wrapper } = setup()
  client.setQueryData(['digest', 'intraday', '2026-11-03'], digest('intraday', 'OLD'))
  const build = renderHook(() => useBuildDigest(), { wrapper })

  await act(async () => {
    await expect(build.result.current.mutateAsync()).rejects.toThrow(message)
  })

  expect(client.getQueryState(['digest', 'intraday', '2026-11-03'])?.isInvalidated).toBe(false)
})

test('an open morning view picks up the late edition without a focus change', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T13:00:00Z'))
  vi.mocked(getMorningDigest).mockResolvedValueOnce(digest('early', 'EARLY')).mockResolvedValue(digest('late', 'LATE'))
  const { wrapper } = setup()
  const view = renderHook(() => useDigest('morning'), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(10) })
  expect(view.result.current.data?.edition).toBe('early')

  await act(async () => { await vi.advanceTimersByTimeAsync(60_010) })

  expect(view.result.current.data?.edition).toBe('late')
})

test('today rolls over at New York midnight into a separate dated cache entry', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T04:59:50Z'))
  vi.mocked(getMorningDigest).mockImplementation(async (date) => ({ ...digest('late', 'DAY'), digest_date: date! }))
  const { client, wrapper } = setup()
  const view = renderHook(() => useDigest('morning'), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(10) })
  expect(view.result.current.data?.digest_date).toBe('2026-11-03')

  await act(async () => { await vi.advanceTimersByTimeAsync(30_010) })
  await act(async () => { await vi.advanceTimersByTimeAsync(10) })

  expect(view.result.current.data?.digest_date).toBe('2026-11-04')
  expect(client.getQueryData(['digest', 'morning', '2026-11-03'])).toBeDefined()
  expect(client.getQueryData(['digest', 'morning', '2026-11-04'])).toBeDefined()
})

test('a historical edition remains on its date and does not poll', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T04:59:50Z'))
  vi.mocked(getMorningDigest).mockResolvedValue({ ...digest('late', 'PAST'), digest_date: '2026-10-30' })
  const { wrapper } = setup()
  const view = renderHook(() => useDigest('morning', '2026-10-30'), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(180_010) })

  expect(view.result.current.data?.digest_date).toBe('2026-10-30')
  expect(getMorningDigest).toHaveBeenCalledTimes(1)
})

test('restoring a hidden ticker refreshes both editions and the hidden list', async () => {
  vi.mocked(restoreDigestItem).mockResolvedValue(undefined)
  const { client, wrapper } = setup()
  client.setQueryData(['digest', 'morning', '2026-11-03'], digest('late', 'MORN'))
  client.setQueryData(['digest', 'intraday', '2026-11-03'], digest('intraday', 'INTRA'))
  client.setQueryData(['digest-dismissals'], [{ ticker: 'HIDE' }])
  const restore = renderHook(() => useRestoreDigestItem(), { wrapper })

  await act(() => restore.result.current.mutateAsync('HIDE'))

  expect(client.getQueryState(['digest', 'morning', '2026-11-03'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['digest', 'intraday', '2026-11-03'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['digest-dismissals'])?.isInvalidated).toBe(true)
})
