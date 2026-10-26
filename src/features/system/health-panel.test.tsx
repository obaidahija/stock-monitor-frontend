import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { HealthResponse, SourceHealthOut } from '@/types/api'
import { HealthPanel } from './health-panel'

let health: HealthResponse

vi.mock('./hooks', () => ({
  useHealth: () => ({ data: health, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}))

afterEach(cleanup)

function source(overrides: Partial<SourceHealthOut>): SourceHealthOut {
  return {
    name: 'edgar',
    ok: true,
    fetched_at: '2026-10-26T13:00:00Z',
    error: null,
    latency_ms: null,
    state: 'healthy',
    last_attempt_at: '2026-10-26T13:00:00Z',
    age_seconds: 60,
    attempted: 1,
    succeeded: 1,
    failed: 0,
    producer: 'edgar_poll',
    count_unit: 'requests',
    ...overrides,
  }
}

function renderWith(sources: SourceHealthOut[]) {
  health = {
    status: 'ok',
    scheduler_running: true,
    sources,
    twitter: {} as HealthResponse['twitter'],
  }
  render(<HealthPanel />)
}

function card(name: string) {
  return within(screen.getByRole('group', { name }))
}

test('labels each provider state and keeps the last success visible through a failure', () => {
  renderWith([
    source({ name: 'edgar' }),
    source({
      name: 'yfinance',
      ok: false,
      state: 'partial',
      attempted: 900,
      succeeded: 850,
      failed: 50,
      producer: 'price_sync',
      count_unit: 'tickers',
      error: 'HTTP 429',
    }),
    source({
      name: 'finnhub',
      ok: false,
      state: 'failed',
      fetched_at: '2026-10-26T11:00:00Z',
      age_seconds: 7200,
      attempted: 3,
      succeeded: 0,
      failed: 3,
      producer: 'news_ingest',
      error: 'HTTP 500',
    }),
    source({
      name: 'telegram',
      ok: false,
      state: 'unknown',
      fetched_at: null,
      last_attempt_at: null,
      age_seconds: null,
      attempted: null,
      succeeded: null,
      failed: null,
      producer: null,
      count_unit: null,
      error: 'not yet fetched',
    }),
  ])

  expect(card('edgar').getByText('healthy')).toBeInTheDocument()
  expect(card('edgar').getByText('Last success 1 minute ago')).toBeInTheDocument()

  expect(card('yfinance').getByText('partial')).toBeInTheDocument()
  expect(card('yfinance').getByText(/850 of 900 tickers succeeded \(price_sync\)/)).toBeInTheDocument()
  expect(card('yfinance').getByText('HTTP 429')).toBeInTheDocument()

  expect(card('finnhub').getByText('failed')).toBeInTheDocument()
  expect(card('finnhub').getByText('Last success 2 hours ago')).toBeInTheDocument()
  expect(card('finnhub').getByText(/0 of 3 requests succeeded/)).toBeInTheDocument()

  expect(card('telegram').getByText('unknown')).toBeInTheDocument()
  expect(card('telegram').getByText('No fetch attempt recorded yet')).toBeInTheDocument()
  expect(card('telegram').queryByText('error')).not.toBeInTheDocument()
})

test('an older backend without provider states still reads ok or error', () => {
  renderWith([
    { name: 'edgar', ok: true, fetched_at: null, error: null, latency_ms: null },
    { name: 'rss', ok: false, fetched_at: null, error: 'not yet fetched', latency_ms: null },
  ])

  expect(card('edgar').getByText('ok')).toBeInTheDocument()
  expect(card('rss').getByText('error')).toBeInTheDocument()
  expect(card('rss').getByText('not yet fetched')).toBeInTheDocument()
})
