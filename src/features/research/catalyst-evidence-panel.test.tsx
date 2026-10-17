import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { CatalystEvidencePanel } from './catalyst-evidence-panel'
import { getCatalystEvidence } from './catalyst-evidence'
import type { CatalystEvidence, HistoricalContext } from './catalyst-evidence'

vi.mock('./catalyst-evidence', () => ({ getCatalystEvidence: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const history: HistoricalContext = {
  status: 'ok', as_of: '2026-10-12T14:36:40Z', version: 'catalyst-history-2026-10-12',
  observations: 1624, paired_observations: 1603, event_rate: .288, control_rate: .129,
  overlapping_observations: 318,
}

function evidence(): CatalystEvidence {
  return {
    candidate_id: 1, ticker: 'ABC', category: 'earnings_guidance', clock: 'publication',
    generated_at: '2026-10-12T14:00:00Z', anchor_at: '2026-10-09T12:00:00Z',
    published_at: '2026-10-09T12:00:00Z', first_seen_at: '2026-10-09T13:00:00Z',
    detection_lag_hours: 1, original_article_status: 'unknown', issuer_event_status: 'unknown',
    original_article_on: null, issuer_event_on: null, status: 'ok', baseline_session: '2026-10-08',
    reaction_session: '2026-10-09', baseline_close: 100, prior_atr: 2, intraday_anchor: false,
    pre_5_session_excess_pct: 0, timeline: [], limits: ['Issuer event date unverified'],
    windows: [
      { horizon: 0, status: 'ok', ends_at: '2026-10-09T20:00:00Z', stock_close: 102,
        stock_pct: 2, spy_pct: 1, excess_pct: 1, excess_atr: .5, mean_volume_ratio: 2,
        other_detected_events: 1, history },
      { horizon: 3, status: 'pending', ends_at: '2026-10-14T20:00:00Z', stock_close: null,
        stock_pct: null, spy_pct: null, excess_pct: null, excess_atr: null, mean_volume_ratio: null,
        other_detected_events: null, history: { ...history, status: 'no_controls', paired_observations: 0, event_rate: null, control_rate: null } },
    ],
  }
}

test('shows historical context without requesting price data until expanded', () => {
  renderWithProviders(<CatalystEvidencePanel candidateId={1} context={history} />)
  expect(screen.getByText(/28.8% event windows vs 12.9%/)).toBeInTheDocument()
  expect(getCatalystEvidence).not.toHaveBeenCalled()
})

test('expands cached evidence and distinguishes pending outcomes from zero moves', async () => {
  vi.mocked(getCatalystEvidence).mockResolvedValue(evidence())
  renderWithProviders(<CatalystEvidencePanel candidateId={1} />)
  await userEvent.click(screen.getByText('Price timeline & history'))
  expect(await screen.findByText(/window close \$102.00/)).toBeInTheDocument()
  expect(getCatalystEvidence).toHaveBeenCalledWith(1, 'publication')
  expect(screen.getByText(/publisher date: unverified/i)).toBeInTheDocument()
  expect(screen.getByText(/relative \+1.00 pp/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Price window'), { target: { value: '3' } })
  expect(screen.getByText(/Awaiting session close/)).toBeInTheDocument()
  expect(screen.queryByText(/relative \+1.00 pp/)).not.toBeInTheDocument()
  expect(screen.getByText(/matched controls unavailable/)).toBeInTheDocument()
})

test('changing clock does not show the old publication result while loading', async () => {
  vi.mocked(getCatalystEvidence).mockResolvedValueOnce(evidence()).mockImplementationOnce(() => new Promise(() => {}))
  renderWithProviders(<CatalystEvidencePanel candidateId={1} />)
  await userEvent.click(screen.getByText('Price timeline & history'))
  await screen.findByText(/window close \$102.00/)
  fireEvent.change(screen.getByLabelText('Timeline'), { target: { value: 'first_seen' } })
  await waitFor(() => expect(getCatalystEvidence).toHaveBeenLastCalledWith(1, 'first_seen'))
  expect(screen.queryByText(/window close \$102.00/)).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading cached price evidence')
})

test('changing candidate never leaves the previous stock evidence on screen', async () => {
  vi.mocked(getCatalystEvidence).mockResolvedValueOnce(evidence()).mockImplementationOnce(() => new Promise(() => {}))
  const result = renderWithProviders(<CatalystEvidencePanel candidateId={1} />)
  await userEvent.click(screen.getByText('Price timeline & history'))
  await screen.findByText(/window close \$102.00/)
  result.rerender(<CatalystEvidencePanel candidateId={2} />)
  await waitFor(() => expect(getCatalystEvidence).toHaveBeenLastCalledWith(2, 'publication'))
  expect(screen.queryByText(/window close \$102.00/)).not.toBeInTheDocument()
})

test('missing cached prices preserve the historical comparison and explain the limit', async () => {
  const payload = evidence()
  payload.status = 'baseline_unavailable'
  payload.baseline_close = null
  payload.windows[0] = { ...payload.windows[0], status: 'baseline_unavailable', stock_close: null,
    stock_pct: null, spy_pct: null, excess_pct: null, excess_atr: null, mean_volume_ratio: null }
  vi.mocked(getCatalystEvidence).mockResolvedValue(payload)
  renderWithProviders(<CatalystEvidencePanel candidateId={1} />)
  await userEvent.click(screen.getByText('Price timeline & history'))
  expect((await screen.findAllByText(/Prior price baseline unavailable/)).length).toBeGreaterThan(0)
  expect(screen.getByText(/28.8% event windows vs 12.9%/)).toBeInTheDocument()
  expect(screen.queryByText(/Stock \+0.00%/)).not.toBeInTheDocument()
})

test('request errors offer a retry', async () => {
  vi.mocked(getCatalystEvidence).mockRejectedValue(new Error('Offline'))
  renderWithProviders(<CatalystEvidencePanel candidateId={1} />)
  await userEvent.click(screen.getByText('Price timeline & history'))
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
})
