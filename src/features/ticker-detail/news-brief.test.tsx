import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getNewsBrief, refreshNewsBrief } from '@/api/stocks'
import { renderWithProviders } from '@/test/render'
import type { TickerNewsBriefOut } from '@/types/api'
import { NewsBrief } from './news-brief'

vi.mock('@/api/stocks', () => ({ getNewsBrief: vi.fn(), refreshNewsBrief: vi.fn() }))

const ok = { name: 'google_finance', ok: true, fetched_at: '2026-10-30T16:00:00Z', error: null, latency_ms: null }

const brief: TickerNewsBriefOut = {
  snapshot_id: 1,
  ticker: 'NVDA',
  generated_at: '2026-10-30T16:00:00Z',
  cached: true,
  caveat: 'AI-generated from Google Finance Research.',
  source: ok,
  sources: [{ id: 1, title: 'Oracle expands', publisher: 'NVIDIA Newsroom', url: 'https://n.com/1' }],
  items: [
    {
      headline: 'Oracle expands Vera Rubin superclusters',
      summary: 'Nvidia and Oracle expanded OCI Superclusters.',
      direction: 'positive',
      impact: 'high',
      impact_reason: 'Large data center orders could support revenue.',
      reported_date: '2026-10-27',
      source_ids: [1],
      evidence_quote: 'Nvidia and Oracle expanded OCI Superclusters.',
    },
    {
      headline: 'DOJ inquiry into Hugging Face deal',
      summary: 'The DOJ is reportedly reviewing the deal.',
      direction: 'negative',
      impact: 'medium',
      impact_reason: 'Regulatory review could delay the acquisition.',
      reported_date: '2026-10-28',
      source_ids: [1],
      evidence_quote: 'The DOJ is reportedly reviewing the deal.',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

test('offers to generate when nothing is saved, then shows the new brief', async () => {
  vi.mocked(getNewsBrief).mockResolvedValue(null)
  vi.mocked(refreshNewsBrief).mockResolvedValue({ ...brief, cached: false })
  renderWithProviders(<NewsBrief ticker="NVDA" />)
  expect(await screen.findByText(/No brief yet/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  expect(await screen.findByText('Oracle expands Vera Rubin superclusters')).toBeVisible()
  expect(refreshNewsBrief).toHaveBeenCalledWith('NVDA', false)
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
})

test('shows direction counts and expands an item with its reason and source', async () => {
  vi.mocked(getNewsBrief).mockResolvedValue(brief)
  renderWithProviders(<NewsBrief ticker="NVDA" />)
  expect(await screen.findByText('1 positive')).toBeVisible()
  expect(screen.getByText('1 negative')).toBeVisible()
  expect(screen.getByText('high impact')).toBeVisible()
  expect(screen.queryByText(/Large data center orders/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Oracle expands Vera Rubin/ }))
  expect(screen.getByText(/Large data center orders/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'NVIDIA Newsroom' })).toHaveAttribute('href', 'https://n.com/1')
})

test('shows how the stock reacted above the items', async () => {
  vi.mocked(getNewsBrief).mockResolvedValue({
    ...brief,
    stock_reaction: {
      move: 'down',
      summary: 'Shares fell 15.8% on fears that NAND margins have peaked.',
      source_ids: [1],
      evidence_quote: 'fell approximately 15.8% over the last 7 days',
    },
  })
  renderWithProviders(<NewsBrief ticker="NVDA" />)
  const reaction = await screen.findByLabelText('Stock reaction')
  expect(reaction).toHaveTextContent('How the stock reacted: Shares fell 15.8%')
  expect(reaction.compareDocumentPosition(screen.getByText('Oracle expands Vera Rubin superclusters')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('a failed refresh keeps the saved brief and shows the error', async () => {
  vi.mocked(getNewsBrief).mockResolvedValue(brief)
  vi.mocked(refreshNewsBrief).mockResolvedValue({
    ...brief, snapshot_id: null, items: [], sources: [], cached: false,
    source: { ...ok, ok: false, error: 'No recent company-specific news could be verified.' },
  })
  renderWithProviders(<NewsBrief ticker="NVDA" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could be verified')
  expect(refreshNewsBrief).toHaveBeenCalledWith('NVDA', true)
  expect(screen.getByText('Oracle expands Vera Rubin superclusters')).toBeVisible()
})
