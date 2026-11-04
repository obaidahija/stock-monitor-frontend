import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Toaster, toast } from 'sonner'
import { ApiError, apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { DigestOut } from '@/types/api'
import { DigestPage } from './digest-page'

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const morning: DigestOut = {
  digest_date: '2026-11-03', generated_at: '2026-11-03T14:05:00Z', edition: 'late',
  snapshot_id: 87, capture_completed_at: '2026-11-03T14:05:30Z', preliminary: false,
  payload: { digest_date: '2026-11-03', generated_at: '2026-11-03T14:05:00Z', items: [{
    ticker: 'AAPL', section: 'earnings', tier: 2, reasons: ['Earnings reported today'],
    stages: ['earnings'], premarket: null, premarket_gap_pct: null, volume_ratio: null,
    pct_from_12wk_avg: null, recent_pattern: null, top_filing: null, top_earnings: null,
    news_count_24h: 0, headline_snippets: [], sentiment: null,
  }] },
}
let displayed = morning

beforeEach(() => {
  displayed = morning
  vi.mocked(apiClient.get).mockImplementation(async (path) => {
    if (path.startsWith('/v1/digest/morning')) return displayed as never
    if (path.startsWith('/v1/digest/intraday')) throw new ApiError(404, 'no intraday digest')
    if (path === '/v1/notifications/telegram/status') return { configured: true, ready: true, error: null, digest_enabled: false } as never
    if (path === '/v1/digest/dismissals') return [] as never
    return {} as never
  })
  vi.mocked(apiClient.post).mockResolvedValue([])
})
afterEach(() => { cleanup(); toast.dismiss(); vi.clearAllMocks() })

test.each([
  { status: 'failed', error: 'Calendar unavailable', detail: null, message: 'Calendar unavailable' },
  { status: 'skipped', error: null, detail: { reason: 'already running' }, message: 'already running' },
])('a $status build displays its error and retains Morning', async ({ status, error, detail, message }) => {
  const user = userEvent.setup()
  vi.mocked(apiClient.post).mockImplementation(async (path) => (
    path.includes('/jobs/') ? { job_run_id: 1, status, error, detail } : []
  ) as never)
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'AAPL' })

  await user.click(screen.getByRole('button', { name: 'Build update' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: 'Morning', pressed: true })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'AAPL' })).toBeInTheDocument()
})

test('an HTTP build error is visible and can be retried from the current edition', async () => {
  const user = userEvent.setup()
  vi.mocked(apiClient.post).mockImplementation(async (path) => {
    if (path.includes('/jobs/')) throw new ApiError(503, 'Build service unavailable')
    return [] as never
  })
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'AAPL' })

  await user.click(screen.getByRole('button', { name: 'Build update' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Build service unavailable')
  expect(screen.getByRole('button', { name: 'Build update' })).toBeEnabled()
  expect(screen.getByRole('link', { name: 'AAPL' })).toBeInTheDocument()
})

test('large coverage stays bounded, pages forward, and a search resets to matching results', async () => {
  const user = userEvent.setup()
  displayed = { ...morning, payload: { ...morning.payload, items: Array.from({ length: 55 }, (_, index) => ({
    ...morning.payload.items[0], ticker: `T${index}`, new_today: index % 2 === 0,
  })) } }
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'T0' })

  await user.click(screen.getByRole('button', { name: /show all coverage/i }))

  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 1–24 of 55 tickers')
  expect(screen.getByRole('link', { name: 'T23' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'T24' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByRole('link', { name: 'T24' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'T0' })).not.toBeInTheDocument()

  await user.type(screen.getByRole('searchbox', { name: 'Search digest coverage' }), 'T48')

  expect(screen.getByRole('link', { name: 'T48' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'T24' })).not.toBeInTheDocument()
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 1 of 1 matches')
})

test('new-only combines with an accessible stage selection', async () => {
  const user = userEvent.setup()
  displayed = { ...morning, payload: { ...morning.payload, items: [
    { ...morning.payload.items[0], new_today: true },
    { ...morning.payload.items[0], ticker: 'NVDA', new_today: false },
  ] } }
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'AAPL' })

  await user.click(screen.getByRole('button', { name: 'New only' }))
  const stage = screen.getByRole('button', { name: 'Earnings (2)' })
  await user.click(stage)

  expect(stage).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('link', { name: 'AAPL' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'NVDA' })).not.toBeInTheDocument()
})

test('new-only explains unknown novelty in the selected stage and can include those matches again', async () => {
  const user = userEvent.setup()
  displayed = { ...morning, payload: { ...morning.payload, items: [
    { ...morning.payload.items[0], ticker: 'MARKED', section: 'premarket_gap', stages: ['premarket_gap'], new_today: true },
    { ...morning.payload.items[0], ticker: 'UNKNOWN', section: 'premarket_gap', stages: ['premarket_gap'], new_today: null },
    { ...morning.payload.items[0], ticker: 'LEGACY', section: 'premarket_gap', stages: ['premarket_gap'] },
    { ...morning.payload.items[0], ticker: 'UNRELATED', new_today: null },
  ] } }
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'MARKED' })
  await user.click(screen.getByRole('button', { name: 'New only' }))
  await user.click(screen.getByRole('button', { name: 'Premarket gap (3)' }))
  expect(screen.getByTestId('digest-newness-note')).toHaveTextContent('2 matching entries have no recorded New label')
  expect(screen.queryByRole('link', { name: 'UNKNOWN' })).not.toBeInTheDocument()

  await user.type(screen.getByRole('searchbox', { name: 'Search digest coverage' }), 'UNKNOWN')
  expect(screen.getByTestId('digest-newness-note')).toHaveTextContent('1 matching entry has no recorded New label')
  await user.click(screen.getByRole('button', { name: 'Remove New only filter' }))
  expect(screen.getByRole('link', { name: 'UNKNOWN' })).toBeVisible()
  expect(screen.queryByTestId('digest-newness-note')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search digest coverage' })).toHaveValue('UNKNOWN')
  expect(screen.getByRole('button', { name: 'Premarket gap (3)' })).toHaveAttribute('aria-pressed', 'true')
})

test('news-volume bookmarks and controls filter legacy section-only signals', async () => {
  const user = userEvent.setup()
  displayed = { ...morning, payload: { ...morning.payload, items: [
    { ...morning.payload.items[0], ticker: 'NEWSA', section: 'news_volume', stages: ['score_leader'] },
    { ...morning.payload.items[0], ticker: 'NEWSB', section: 'news_volume', stages: [] },
    { ...morning.payload.items[0], ticker: 'RESULTS' },
  ] } }
  renderWithProviders(<DigestPage />, ['/?stages=news_volume'])
  await screen.findByRole('link', { name: 'NEWSA' })
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 2 of 2 matches')
  expect(screen.queryByRole('link', { name: 'RESULTS' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'News volume (2)' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Clear' }))
  await user.click(screen.getByRole('button', { name: 'News volume (2)' }))
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 2 of 2 matches')
})

test('a historical bookmark reads its own date and the date control changes it', async () => {
  renderWithProviders(<DigestPage />, ['/?date=2026-10-30'])
  await screen.findByRole('link', { name: 'AAPL' })

  expect(apiClient.get).toHaveBeenCalledWith('/v1/digest/morning?date=2026-10-30')
  fireEvent.change(screen.getByLabelText('Edition date (ET)'), { target: { value: '2026-10-29' } })

  await screen.findByRole('link', { name: 'AAPL' })
  expect(apiClient.get).toHaveBeenCalledWith('/v1/digest/morning?date=2026-10-29')
})

test('Undo restores a ticker after its card has left the saved edition', async () => {
  const user = userEvent.setup()
  vi.mocked(apiClient.delete).mockImplementation(async () => {
    displayed = { ...morning, payload: { ...morning.payload, items: [] } }
    return undefined as never
  })
  vi.mocked(apiClient.post).mockImplementation(async (path) => {
    if (path.endsWith('/restore')) displayed = morning
    return undefined as never
  })
  renderWithProviders(<><DigestPage /><Toaster /></>)
  await screen.findByRole('link', { name: 'AAPL' })

  await user.click(screen.getByRole('button', { name: 'Hide AAPL from digest' }))
  await screen.findByText('No signals in this edition')
  expect(screen.queryByRole('link', { name: 'AAPL' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hidden tickers' })).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'Undo' }))

  expect(await screen.findByRole('link', { name: 'AAPL' })).toBeInTheDocument()
})

test('the hidden manager loads on demand and restores its selected ticker', async () => {
  const user = userEvent.setup()
  let hidden = true
  vi.mocked(apiClient.get).mockImplementation(async (path) => {
    if (path.startsWith('/v1/digest/morning')) return morning as never
    if (path === '/v1/digest/dismissals') return (hidden
      ? [{ ticker: 'NVDA', dismissed_at: '2026-11-02T12:00:00Z', expires_at: '2026-11-09T12:00:00Z' }] : []) as never
    return {} as never
  })
  vi.mocked(apiClient.post).mockImplementation(async (path) => {
    if (path === '/v1/digest/NVDA/restore') hidden = false
    return undefined as never
  })
  renderWithProviders(<DigestPage />)
  await screen.findByRole('link', { name: 'AAPL' })
  expect(apiClient.get).not.toHaveBeenCalledWith('/v1/digest/dismissals')

  await user.click(screen.getByRole('button', { name: 'Hidden tickers' }))
  await user.click(await screen.findByRole('button', { name: 'Restore NVDA' }))

  expect(await screen.findByText('No hidden tickers.')).toBeVisible()
})
