import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { DigestResearchFirst, DiscoverResearchFirst } from './research-first-panel'
import { getResearchFirst } from './api'
import type { ResearchFirstReport } from './types'

vi.mock('./api', () => ({ getResearchFirst: vi.fn() }))
vi.mock('@/features/watchlists/manage-lists-dialog', () => ({ ManageListsDialog: () => <button>Manage lists</button> }))
vi.mock('@/features/watchlists/follow-through-control', () => ({
  FollowThroughControl: ({ initialHorizon }: { initialHorizon: number }) => <button>Track {initialHorizon} sessions</button>,
}))
vi.mock('@/features/research/hooks', () => ({ useResearchCapabilities: () => ({ data: { follow_through_enabled: true } }) }))

function report(horizon = 5, ticker = 'ABC'): ResearchFirstReport {
  return {
    rule_version: 'research-first-v1', generated_at: '2026-09-28T14:00:00Z',
    window: { starts_at: '2026-09-28T14:00:00Z', anchor_session: '2026-09-28', horizon_sessions: horizon,
      expires_at: '2026-10-02T20:00:00Z', expires_on: '2026-10-02', calendar: 'XNYS', window_version: 'swing-window-v1' },
    eligible_tickers: 1, coverage: { status: 'complete' }, collection_enabled: true,
    items: [{ rank: 1, ticker, company_name: 'Example Inc', candidate_id: 1,
      headline: `${ticker} announces a new contract`, category: 'product_contract_regulatory_approval',
      published_at: '2026-09-28T12:00:00Z', source_url: 'https://example.com/news', source_name: 'Issuer',
      priority_points: 5, ranking: [{ label: 'Fresh issuer event', points: 3 }, { label: 'Published within 24 hours', points: 2 }],
      composite_score: 70, lean: 'bullish', score_updated_at: '2026-09-28T13:00:00Z',
      observed_direction: 'down', reaction_atr: -1, volume_ratio: null, reaction_observed_at: '2026-09-28T13:00:00Z',
      earnings_date: null, earnings_timing: null, earnings_overlap: null, selected_volatility: null,
      supporting_evidence: ['Completed daily reaction -1.00 ATR'],
      risks: ['Observed price direction opposes the composite lean'], data_limits: ['Daily volume comparison unavailable'] }],
  }
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

test('shows evidence, disagreement, source and exact-horizon actions', async () => {
  vi.mocked(getResearchFirst).mockResolvedValue(report(3))
  renderWithProviders(<DiscoverResearchFirst />, ['/discover?horizon_sessions=3'])
  expect(await screen.findByText('ABC announces a new contract')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open ABC analysis' })).toHaveAttribute('href', '/stocks/ABC?tab=analysis&horizon_sessions=3')
  expect(screen.getByRole('link', { name: 'Issuer' })).toHaveAttribute('href', 'https://example.com/news')
  expect(screen.getByText('Observed price direction opposes the composite lean')).toBeInTheDocument()
  expect(screen.getByText('Daily volume comparison unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Track 3 sessions' })).toBeInTheDocument()
  fireEvent.click(screen.getByText('Why this rank?'))
  expect(screen.getByText('Fresh issuer event')).toBeInTheDocument()
})

test('changing horizon requests new evidence and removes old cards while pending', async () => {
  vi.mocked(getResearchFirst).mockResolvedValueOnce(report(5)).mockImplementationOnce(() => new Promise(() => {}))
  renderWithProviders(<DiscoverResearchFirst />)
  await screen.findByText('ABC announces a new contract')
  fireEvent.change(screen.getByLabelText('Research horizon'), { target: { value: '1' } })
  await waitFor(() => expect(getResearchFirst).toHaveBeenLastCalledWith(1))
  expect(screen.queryByText('ABC announces a new contract')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Finding research priorities')
})

test('digest switches saved snapshots without making a live request', () => {
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': report(5), '1': report(1, 'XYZ') }} />)
  expect(screen.getByText('ABC announces a new contract')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Research horizon'), { target: { value: '1' } })
  expect(screen.getByText('XYZ announces a new contract')).toBeInTheDocument()
  expect(screen.queryByText('ABC announces a new contract')).not.toBeInTheDocument()
  expect(getResearchFirst).not.toHaveBeenCalled()
  expect(screen.getByText(/Saved with this digest/)).toBeInTheDocument()
})

test('old digests explain how to obtain a shortlist', () => {
  renderWithProviders(<DigestResearchFirst />)
  expect(screen.getByText(/Rebuild the digest/)).toBeInTheDocument()
  expect(getResearchFirst).not.toHaveBeenCalled()
})

test('empty evidence is not filled with high-score guesses', async () => {
  vi.mocked(getResearchFirst).mockResolvedValue({ ...report(), items: [], eligible_tickers: 0 })
  renderWithProviders(<DiscoverResearchFirst />)
  expect(await screen.findByText(/No fresh events or overlapping earnings/)).toBeInTheDocument()
})

test('failed live request offers a retry', async () => {
  vi.mocked(getResearchFirst).mockRejectedValue(new Error('Offline'))
  renderWithProviders(<DiscoverResearchFirst />)
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
})

test('invalid URL horizon falls back to five and unsafe source is not linked', () => {
  const snapshot = report()
  snapshot.items[0].source_url = 'javascript:alert(1)'
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />, ['/digest?horizon_sessions=99'])
  expect(screen.getByLabelText('Research horizon')).toHaveValue('5')
  expect(screen.queryByRole('link', { name: 'Issuer' })).not.toBeInTheDocument()
})

test('tentative merger report is visibly distinct from an announced event', async () => {
  const snapshot = report()
  snapshot.rule_version = 'research-first-v2'
  snapshot.items[0].event_status = 'tentative'
  snapshot.items[0].headline = 'Foreign banks expressed merger interest'
  snapshot.items[0].risks = ['Merger interest or talks are unconfirmed; no agreement is announced']
  snapshot.items[0].ranking = [{ label: 'Reported merger interest or talks', points: 1 }]
  vi.mocked(getResearchFirst).mockResolvedValue(snapshot)
  renderWithProviders(<DiscoverResearchFirst />)
  expect(await screen.findByText('Foreign banks expressed merger interest')).toBeInTheDocument()
  expect(screen.getByText('Reported talks')).toBeInTheDocument()
  expect(screen.getByText(/no agreement is announced/)).toBeInTheDocument()
})

test('v3 separates feed time from publisher and issuer dates', async () => {
  const snapshot = report()
  snapshot.rule_version = 'research-first-v3'
  snapshot.items[0].original_article_status = 'unavailable'
  snapshot.items[0].issuer_event_status = 'verified'
  snapshot.items[0].issuer_event_on = '2026-09-23'
  snapshot.items[0].issuer_event_evidence_url = 'https://issuer.example.com/release'
  vi.mocked(getResearchFirst).mockResolvedValue(snapshot)
  renderWithProviders(<DiscoverResearchFirst />)
  expect(await screen.findByText('ABC announces a new contract')).toBeInTheDocument()
  expect(screen.getByText(/Feed time:/)).toBeInTheDocument()
  expect(screen.getByText('Publisher date: unavailable')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Issuer event: 2026-09-23' })).toHaveAttribute(
    'href', 'https://issuer.example.com/release',
  )
})

test('scheduled earnings do not show article date warnings', () => {
  const snapshot = report()
  snapshot.rule_version = 'research-first-v3'
  snapshot.items[0].candidate_id = null
  snapshot.items[0].event_status = 'scheduled'
  snapshot.items[0].published_at = null
  snapshot.items[0].original_article_status = 'unknown'
  snapshot.items[0].issuer_event_status = 'unknown'
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  expect(screen.getByText('Upcoming earnings')).toBeInTheDocument()
  expect(screen.queryByText(/Publisher date:/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Issuer event date:/)).not.toBeInTheDocument()
})

test('analyst reports do not imply an issuer event date', () => {
  const snapshot = report()
  snapshot.rule_version = 'research-first-v3'
  snapshot.items[0].category = 'analyst_action'
  snapshot.items[0].original_article_status = 'unknown'
  snapshot.items[0].issuer_event_status = 'unknown'
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  expect(screen.getByText('Publisher date: unverified')).toBeInTheDocument()
  expect(screen.queryByText(/Issuer event date:/)).not.toBeInTheDocument()
})
