import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { ExpectedFilingOut, FilingIntelFilingOut } from '@/types/filing-intel'
import { FilingsPage } from './filings-page'
import { parseTickers } from '@/features/filing-intel/labels'

const hooks = vi.hoisted(() => ({
  useUpcomingFilings: vi.fn(),
  useRecentFilings: vi.fn(),
  useFiling: vi.fn(),
  useFilingEpisodes: vi.fn(),
  useAnalyzeFilings: vi.fn(),
  useCurrentPrices: vi.fn(),
}))
vi.mock('@/features/filing-intel/hooks', () => hooks)

const SLS_FINAL: FilingIntelFilingOut = {
  accession: '0001104659-26-130132',
  ticker: 'SLS',
  cik: '0001390478',
  form: '424B5',
  item_codes: [],
  accepted_at: '2026-11-19T21:07:00Z',
  detected_at: '2026-11-19T21:07:21Z',
  detected_via: 'feed',
  coverage: 'extended',
  detection_lag_seconds: 21,
  period_of_report: null,
  status: 'extracted',
  error_code: null,
  summary: '424B5: offering final, 11.54M sh, @ $13.00, -27.6% vs $17.95 close, $150M gross',
  extraction_version: 1,
  extract_ms: 13.5,
  warnings: [],
  detected_price: 13.5,
  detected_price_session: 'post',
  detected_price_time: '2026-11-19T21:07:30Z',
  ref_close: 14.86,
  ref_close_date: '2026-11-19',
  close_1d: 13.66,
  close_1d_date: '2026-11-20',
  close_5d: null,
  close_5d_date: null,
  documents: { 'tm2629996d2_424b5.htm': 'a'.repeat(64), 'tm2629996d2_exfilingfees.htm': 'b'.repeat(64) },
  url: 'https://www.sec.gov/Archives/edgar/data/1390478/000110465926130132/0001104659-26-130132-index.html',
  events: [
    {
      event_type: 'securities_offering',
      item: null,
      topic: null,
      direction: null,
      method: 'rule',
      fields: { stage: 'final', shares_offered: 11538462, price_per_share: 13, last_close: 17.95, discount_to_last_close_pct: -27.58 },
      evidence: [{ field: 'last_close', text: 'On November 18, 2026, the closing price ... was $17.95 per share.', document: null }],
    },
  ],
  facts: [],
  features: { feature_version: 1, form: '424B5', offering_dilution_pct: 5.66, offering_discount_pct: -27.58 },
  kind: 'offering',
  other_events: [],
  signal: {
    label: 'negative',
    strength: 'strong',
    reasons: [
      { source: 'disclosed', direction: 'negative', detail: 'equity offering', evidence: ['We are offering 11,538,462 shares of our common stock.'] },
      {
        source: 'tone',
        direction: 'negative',
        detail: 'FinBERT negative 0.93',
        evidence: ['negative 0.93: Proceeds will fund continued losses.', 'against, positive 0.81: The trial met its endpoint.'],
      },
    ],
    version: 1,
  },
}

const EXPECTED: ExpectedFilingOut = {
  ticker: 'ZM',
  form: '8-K 2.02',
  expected_date: '2026-11-23',
  window_start: '2026-11-23T21:00:00Z',
  window_end: '2026-11-23T22:05:00Z',
  window_start_et: '2026-11-23 16:00 ET',
  window_end_et: '2026-11-23 17:05 ET',
  basis: 'earnings_calendar',
  confidence: 'high',
  status: 'filed',
  matched_accession: SLS_FINAL.accession,
  coverage: 'tracked',
  detail: { history_slot: 'amc' },
}

beforeEach(() => {
  hooks.useUpcomingFilings.mockReturnValue({ isPending: false, isError: false, isSuccess: true, data: [EXPECTED] })
  hooks.useRecentFilings.mockReturnValue({ isPending: false, isError: false, isSuccess: true, data: [SLS_FINAL] })
  hooks.useFiling.mockImplementation((accession: string | null) =>
    accession ? { isPending: false, isError: false, data: SLS_FINAL } : { isPending: false, isError: false, data: undefined },
  )
  hooks.useFilingEpisodes.mockReturnValue({ data: [] })
  hooks.useCurrentPrices.mockReturnValue({
    data: new Map([['SLS', { ticker: 'SLS', price: 14.85, session: 'regular', time: '2026-11-23T16:00:00Z' }]]),
  })
  hooks.useAnalyzeFilings.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, data: undefined })
})
afterEach(cleanup)

test('upcoming tab lists expected filings with window, basis and confidence', () => {
  renderWithProviders(<FilingsPage />, ['/filings'])
  const row = screen.getByRole('row', { name: /ZM/ })
  expect(within(row).getByText('8-K earnings')).toBeInTheDocument()
  expect(within(row).getByText('Earnings date')).toBeInTheDocument()
  expect(within(row).getByText('high')).toBeInTheDocument()
})

test('a filed expectation opens the analysis process for the matched filing', async () => {
  const user = userEvent.setup()
  renderWithProviders(<FilingsPage />, ['/filings'])
  await user.click(screen.getByText('filed · view analysis'))
  const process = await screen.findByRole('list', { name: 'Analysis process' })
  expect(within(process).getByText('1. Accepted by the SEC')).toBeInTheDocument()
  expect(within(process).getByText(/21 s after acceptance/)).toBeInTheDocument()
  expect(within(process).getByText('3. Downloaded 2 documents')).toBeInTheDocument()
  expect(screen.getAllByText('-27.58%').length).toBeGreaterThan(0)
  expect(screen.getByText('5.66%')).toBeInTheDocument()
})

test('recent tab shows the one-line summary and marks companies outside the universe', async () => {
  const user = userEvent.setup()
  renderWithProviders(<FilingsPage />, ['/filings?tab=recent'])
  expect(screen.getByText(/offering final, 11.54M sh/)).toBeInTheDocument()
  expect(screen.getByText('Outside universe')).toBeInTheDocument()
  await user.click(screen.getByText(/offering final, 11.54M sh/))
  expect(await screen.findByRole('list', { name: 'Analysis process' })).toBeInTheDocument()
})

test('ticker input is normalized and deduplicated', () => {
  expect(parseTickers('nvda, TGT;sls  tgt')).toEqual(['NVDA', 'TGT', 'SLS'])
})

test('each filing shows the close before it, the reaction and the price now', () => {
  renderWithProviders(<FilingsPage />, ['/filings?tab=recent'])
  expect(screen.getByText('$14.86')).toBeInTheDocument()
  expect(screen.getByText('-8.08%')).toBeInTheDocument() // +1 day: 14.86 -> 13.66
  expect(screen.getByText('-0.07%')).toBeInTheDocument() // now: 14.86 -> 14.85
})

test('the signal shows on the row and its reasons in the panel', async () => {
  const user = userEvent.setup()
  renderWithProviders(<FilingsPage />, ['/filings?tab=recent'])
  expect(screen.getByText('negative · strong')).toBeInTheDocument()
  await user.click(screen.getByText(/offering final, 11.54M sh/))
  expect(await screen.findByText('Positive or negative?')).toBeInTheDocument()
  expect(screen.getByText('FinBERT negative 0.93')).toBeInTheDocument()
  expect(screen.getByText('We are offering 11,538,462 shares of our common stock.')).toBeInTheDocument()
  expect(screen.getByText('Drove the tone · negative 0.93')).toBeInTheDocument()
  expect(screen.getByText('Pulls the other way · positive 0.81')).toBeInTheDocument()
})

test('rows show the filing kind and the kind filter narrows the feed', async () => {
  const user = userEvent.setup()
  renderWithProviders(<FilingsPage />, ['/filings?tab=recent'])
  expect(screen.getByText('Offering', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Earnings' }))
  expect(hooks.useRecentFilings).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'earnings' }))
})
