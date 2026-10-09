import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
})

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks() })

function openPriorities() {
  fireEvent.click(screen.getByRole('button', { name: /Show all \d+ priorities/ }))
}

test('shows evidence, disagreement, source and exact-horizon actions', async () => {
  vi.mocked(getResearchFirst).mockResolvedValue(report(3))
  renderWithProviders(<DiscoverResearchFirst />, ['/discover?horizon_sessions=3'])
  await screen.findByRole('button', { name: 'View ABC research priority' })
  openPriorities()
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
  openPriorities()
  expect(within(screen.getByRole('dialog')).getByText(/Saved with this digest/)).toBeInTheDocument()
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
  openPriorities()
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
  await screen.findByRole('button', { name: 'View ABC research priority' })
  openPriorities()
  expect(within(screen.getByRole('dialog')).getByText('Foreign banks expressed merger interest')).toBeInTheDocument()
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
  await screen.findByRole('button', { name: 'View ABC research priority' })
  openPriorities()
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
  openPriorities()
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
  openPriorities()
  expect(screen.getByText('Publisher date: unverified')).toBeInTheDocument()
  expect(screen.queryByText(/Issuer event date:/)).not.toBeInTheDocument()
})

test('digest reports the first three cards of the selected horizon, independent of expansion', () => {
  const onVisible = vi.fn()
  const five = report(5)
  five.items = ['AAA', 'BBB', 'CCC', 'DDD'].map((ticker, index) => ({
    ...report(5, ticker).items[0], rank: index + 1,
  }))
  renderWithProviders(
    <DigestResearchFirst snapshots={{ '5': five, '1': report(1, 'XYZ') }} onVisibleTickersChange={onVisible} />,
  )
  expect(onVisible).toHaveBeenLastCalledWith(['AAA', 'BBB', 'CCC'])

  fireEvent.click(screen.getByRole('button', { name: 'Show all 4 priorities' }))
  expect(onVisible).toHaveBeenLastCalledWith(['AAA', 'BBB', 'CCC'])

  fireEvent.change(screen.getByLabelText('Panel research horizon'), { target: { value: '1' } })
  expect(onVisible).toHaveBeenLastCalledWith(['XYZ'])

  fireEvent.change(screen.getByLabelText('Panel research horizon'), { target: { value: '3' } })
  expect(onVisible).toHaveBeenLastCalledWith([])
})

test('a watch line shared by every card is said once above the cards', () => {
  const snapshot = report()
  const shared = '2 scheduled market events overlap this window; check Events for details'
  snapshot.items[0].risks = [shared, 'Observed price direction opposes the composite lean']
  snapshot.items.push({ ...snapshot.items[0], rank: 2, ticker: 'XYZ', headline: 'XYZ announces a new contract', risks: [shared] })
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  openPriorities()

  expect(screen.getAllByText(shared)).toHaveLength(1)
  expect(screen.getByText('Observed price direction opposes the composite lean')).toBeInTheDocument()
})

test('keeps source, feed time and dates on one line', () => {
  const snapshot = report()
  snapshot.rule_version = 'research-first-v3'
  snapshot.items[0].original_article_status = 'verified'
  snapshot.items[0].original_article_on = '2026-09-28'
  snapshot.items[0].issuer_event_status = 'unknown'
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  openPriorities()

  expect(screen.getByText(/Feed time:/).parentElement).toHaveTextContent(
    'Issuer · Feed time: Sep 28, 8:00 AM ET · Publisher article: 2026-09-28 · Issuer event date: unverified',
  )
})

test('says the volatility caveat once, in the footer', () => {
  const snapshot = report()
  snapshot.items[0].selected_volatility = {
    horizon_sessions: 5, move_pct: 7.9, sample_count: 60, reason: null,
    quality: { status: 'ok', as_of: null, fetched_at: null, sources: [], reasons: [], price_basis: 'adjusted', market_session: null },
  } as never
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  openPriorities()

  expect(screen.getByText('5-session volatility reference: ±7.9%')).toBeInTheDocument()
  expect(screen.getAllByText(/typical magnitudes, not forecasts/)).toHaveLength(1)
})

test('previews three chips and opens all ranked cards with preserved actions', () => {
  const snapshot = report()
  snapshot.items = ['AAA', 'BBB', 'CCC', 'DDD'].map((ticker, index) => ({
    ...report(5, ticker).items[0], rank: index + 1,
  }))
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  expect(screen.getAllByRole('button', { name: /View .* research priority/ }).map((button) => button.textContent))
    .toEqual(snapshot.items.slice(0, 3).map((item) => `${item.ticker}${item.headline}Composite 70/100 · bullish`))
  expect(screen.queryByRole('link', { name: /Open .* analysis/ })).not.toBeInTheDocument()
  expect(screen.queryByText('DDD announces a new contract')).not.toBeInTheDocument()
  openPriorities()
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getAllByRole('link', { name: /Open .* analysis/ }).map((link) => link.getAttribute('href')))
    .toEqual(snapshot.items.map((item) => `/stocks/${item.ticker}?tab=analysis&horizon_sessions=5`))
  expect(dialog.getByText('DDD announces a new contract')).toBeInTheDocument()
})

test('chip selects and scrolls to its card, Escape restores focus, and Show all resets selection', async () => {
  const user = userEvent.setup()
  const snapshot = report()
  snapshot.items = ['AAA', 'BBB', 'CCC', 'DDD'].map((ticker, index) => ({
    ...report(5, ticker).items[0], rank: index + 1,
  }))
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  const chip = screen.getByRole('button', { name: 'View BBB research priority' })
  await user.click(chip)
  const selected = screen.getByRole('link', { name: 'Open BBB analysis' }).closest('[data-highlighted]')
  expect(selected).toHaveAttribute('data-highlighted', 'true')
  await waitFor(() => expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' }))
  expect(vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts[0]).toBe(selected)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(chip).toHaveFocus()
  const showAll = screen.getByRole('button', { name: 'Show all 4 priorities' })
  await user.click(showAll)
  expect(screen.getByRole('dialog').querySelector('[data-highlighted]')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(showAll).toHaveFocus())
})

test('panel horizon changes reset selection and show saved evidence without live requests', () => {
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': report(5), '1': report(1, 'XYZ') }} />)
  fireEvent.click(screen.getByRole('button', { name: 'View ABC research priority' }))
  fireEvent.change(screen.getByLabelText('Panel research horizon'), { target: { value: '1' } })
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('XYZ announces a new contract')).toBeInTheDocument()
  expect(within(dialog).queryByText('ABC announces a new contract')).not.toBeInTheDocument()
  expect(dialog.querySelector('[data-highlighted]')).toBeNull()
  expect(screen.getByLabelText('Panel research horizon')).toHaveValue('1')
  expect(getResearchFirst).not.toHaveBeenCalled()
})

test('chips handle missing score and lean and still offer Show all for a single item', () => {
  const snapshot = report()
  snapshot.items[0].composite_score = null
  snapshot.items[0].lean = null
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  expect(screen.getByRole('button', { name: 'View ABC research priority' })).toHaveTextContent('Composite unavailable')
  expect(screen.getByRole('button', { name: 'View ABC research priority' })).not.toHaveTextContent('bullish')
  expect(screen.getByRole('button', { name: 'Show all 1 priorities' })).toBeInTheDocument()
})


test('selected card highlight clears after a short interval', () => {
  vi.useFakeTimers()
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': report() }} />)
  fireEvent.click(screen.getByRole('button', { name: 'View ABC research priority' }))
  expect(screen.getByRole('dialog').querySelector('[data-highlighted=true]')).not.toBeNull()
  act(() => vi.advanceTimersByTime(1800))
  expect(screen.getByRole('dialog').querySelector('[data-highlighted=true]')).toBeNull()
})

test('live panel horizon changes hide stale cards while new evidence loads', async () => {
  vi.mocked(getResearchFirst).mockResolvedValueOnce(report(5)).mockImplementationOnce(() => new Promise(() => {}))
  renderWithProviders(<DiscoverResearchFirst />)
  await screen.findByRole('button', { name: 'View ABC research priority' })
  openPriorities()
  fireEvent.change(screen.getByLabelText('Panel research horizon'), { target: { value: '1' } })
  await waitFor(() => expect(getResearchFirst).toHaveBeenLastCalledWith(1))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.queryByText('ABC announces a new contract')).not.toBeInTheDocument()
  expect(dialog.getByRole('status')).toHaveTextContent('Finding research priorities')
})

test('closing after a horizon change restores focus to the page window selector when its chip is gone', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': report(), '1': report(1, 'XYZ') }} />)
  await user.click(screen.getByRole('button', { name: 'View ABC research priority' }))
  await user.selectOptions(screen.getByLabelText('Panel research horizon'), '1')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.getByLabelText('Research horizon')).toHaveFocus())
})

test('fast tooltip reveals full event context and risk without opening the panel', async () => {
  const user = userEvent.setup()
  const snapshot = report()
  snapshot.items[0].headline = 'ABC announces a major international contract with detailed terms and a long event headline'
  snapshot.items[0].original_article_status = 'verified'
  snapshot.items[0].original_article_on = '2026-09-27'
  snapshot.items[0].issuer_event_status = 'unavailable'
  renderWithProviders(<DigestResearchFirst snapshots={{ '5': snapshot }} />)
  const chip = screen.getByRole('button', { name: 'View ABC research priority' })
  expect(within(chip).getByText(snapshot.items[0].headline)).not.toHaveAttribute('title')
  await user.hover(chip)
  const tooltip = within(await screen.findByRole('tooltip'))
  expect(tooltip.getByText('#1 · ABC · Example Inc')).toBeInTheDocument()
  expect(tooltip.getByText(snapshot.items[0].headline)).toBeInTheDocument()
  expect(tooltip.getByText('Reported event')).toBeInTheDocument()
  expect(tooltip.getByText(/Feed time:/)).toBeInTheDocument()
  expect(tooltip.getByText('Publisher date: 2026-09-27')).toBeInTheDocument()
  expect(tooltip.getByText('Issuer event date: unavailable')).toBeInTheDocument()
  expect(tooltip.getByText(/Observed move: down/)).toBeInTheDocument()
  expect(tooltip.getByText('Completed daily reaction -1.00 ATR')).toBeInTheDocument()
  expect(tooltip.getByText(/Observed price direction opposes the composite lean/)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(chip)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})
