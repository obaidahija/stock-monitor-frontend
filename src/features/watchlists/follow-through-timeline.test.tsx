import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useResearchSubscriptions } from '@/features/research/intraday'
import { renderWithProviders } from '@/test/render'
import type { FollowThroughDetailOut } from '@/types/api'
import { baselineMessage, FollowThroughTimeline } from './follow-through-timeline'

test('one-session track is explained rather than extended', () => {
  expect(baselineMessage('available', 'completed', 0))
    .toBe('Window ended before a later close could be observed.')
})

test('pending baseline is not a zero return', () => {
  expect(baselineMessage('pending', 'active', 0)).toBe('Awaiting baseline close.')
})

test('missing expected close is explicit', () => {
  expect(baselineMessage('missing', 'completed', 0)).toBe('Baseline price unavailable.')
})

const detail: FollowThroughDetailOut = {
  track: {
    id: 42, origin: 'catalyst', ticker: 'ABC', setup_id: null, side: 'unassigned',
    setup_revision_id: null, source_candidate_id: 3, observation_id: null,
    started_at: '2026-09-23T14:00:00Z', expected_baseline_at: '2026-09-23T20:00:00Z',
    baseline_session: '2026-09-23', baseline_status: 'pending', baseline_price: null,
    benchmark_symbol: 'SPY', benchmark_label: 'Market benchmark', benchmark_baseline_price: null,
    window: {}, levels: {}, evidence: {}, lifecycle: 'active', ended_at: null, end_reason: null,
    rule_version: 'follow-through-v1',
  },
  rows: [],
  quality: { status: 'ok' },
}

vi.mock('@/features/research/intraday', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/research/intraday')>()),
  useResearchSubscriptions: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

test('intraday collection is not offered while the extension is off', () => {
  vi.mocked(useResearchSubscriptions).mockReturnValue({ data: undefined } as never)
  renderWithProviders(<FollowThroughTimeline detail={detail} intradayEnabled={false} />)
  expect(screen.queryByRole('button', { name: /5-minute/ })).not.toBeInTheDocument()
})

test('an active track can opt in to 5-minute collection', () => {
  vi.mocked(useResearchSubscriptions).mockReturnValue({
    data: { items: [], collection_enabled: true, symbol_limit: 100 },
  } as never)
  renderWithProviders(<FollowThroughTimeline detail={detail} intradayEnabled />)
  expect(screen.getByRole('button', { name: 'Collect 5-minute bars' })).toBeInTheDocument()
})

test('a collected track shows its stored coverage and gaps', () => {
  vi.mocked(useResearchSubscriptions).mockReturnValue({
    data: {
      items: [{
        id: 9, origin_type: 'follow_through', origin_id: 42, ticker: 'ABC', enabled: true,
        created_at: '2026-09-23T14:00:00Z', disabled_at: null, last_attempt_at: null,
        last_success_at: '2026-09-23T14:35:00Z',
        coverage: { status: 'partial', sessions_with_gaps: ['2026-09-22'], last_bar_end: '2026-09-23T14:30:00Z' },
      }],
      collection_enabled: true, symbol_limit: 100,
    },
  } as never)
  renderWithProviders(<FollowThroughTimeline detail={detail} intradayEnabled />)
  expect(screen.getByText(/5-minute coverage partial/)).toBeInTheDocument()
  expect(screen.getByText(/gaps on 2026-09-22/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop 5-minute collection' })).toBeInTheDocument()
})

test('timeline links frozen catalyst evidence and names exact missing-bar quality', () => {
  const selected = {
    ...detail,
    track: {
      ...detail.track,
      evidence: {
        headline: 'ABC wins a contract',
        source_url: 'https://example.com/original',
        published_at: '2026-09-23T12:00:00Z',
      },
    },
    rows: [{
      session_date: '2026-09-24', observed_at: '2026-09-24T20:00:00Z',
      recorded_at: '2026-09-24T21:00:00Z', close: null, benchmark_close: 101,
      metrics: { status: 'pending_data', stock_return_pct: null, raw_excess_pct: null,
        benchmark_return_pct: null, side_aligned_excess_pct: null,
        reference_distance_atr: null, volume_ratio: null, reasons: ['close_missing'] },
      quality: { status: 'pending_data', reasons: ['close_missing'], stock: 'bar_missing',
        benchmark: 'available' },
      evidence: {}, rule_version: 'follow-through-v1', revision: 1,
    }],
  } satisfies FollowThroughDetailOut
  renderWithProviders(<FollowThroughTimeline detail={selected} />)
  expect(screen.getByText('ABC wins a contract')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Original source' }))
    .toHaveAttribute('href', 'https://example.com/original')
  expect(screen.getByText(/stock: bar missing/i)).toBeInTheDocument()
})
