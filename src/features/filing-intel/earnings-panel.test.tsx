import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { FilingKeyFact } from '@/types/api'
import type { EarningsResultOut } from '@/types/earnings-release'
import type { FilingIntelFilingOut } from '@/types/filing-intel'
import { EarningsPanel } from './earnings-panel'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ apiClient: api }))

function fact(overrides: Partial<FilingKeyFact>): FilingKeyFact {
  return {
    metric: 'revenue',
    value: '115,844',
    currency: '$',
    unit: 'million',
    period: 'October 25, 2026',
    period_end: '2026-10-25',
    period_kind: 'quarter',
    basis: 'reported',
    importance: 'high',
    change: null,
    label: 'Revenue',
    warning: false,
    prior_value: '57,006',
    prior_period: 'October 26, 2025',
    yoy_change: '+103.2%',
    evidence: [],
    ...overrides,
  } as FilingKeyFact
}

const RESULT: EarningsResultOut = {
  key_facts: [
    fact({}),
    fact({ metric: 'guidance', value: 'Revenue is expected to be $130.0 billion, plus or minus 3%', unit: null, currency: null, period: 'fourth quarter of fiscal 2027', period_end: null, prior_value: null, prior_period: null, yoy_change: null, label: 'Guidance' }),
  ],
  omitted_key_facts: 0,
  reported_quarter: 'Q3 FY27',
  consensus: { current: { event_date: '2026-11-17', eps_estimate: 2.5, revenue_estimate: 113e9 }, following: null, captured_at: '2026-11-17T21:21:00Z' },
  estimates: {
    eps: { reported: 2.68, basis: 'adjusted', estimate: 2.5, difference: 0.18, surprise_pct: 7.2, result: 'beat' },
    consensus_captured_at: '2026-11-17T21:21:00Z',
  },
}

function filing(overrides: Partial<FilingIntelFilingOut>): FilingIntelFilingOut {
  return {
    accession: '0001045810-26-000088',
    ticker: 'NVDA',
    form: '8-K',
    kind: 'earnings',
    earnings_result: RESULT,
    filing_id: 42,
    ...overrides,
  } as FilingIntelFilingOut
}

beforeEach(() => {
  api.get.mockResolvedValue({ status: 'not_analyzed' })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('shows our release figures and guidance', () => {
  renderWithProviders(<EarningsPanel filing={filing({})} />)
  expect(screen.getByText('Revenue')).toBeInTheDocument()
  expect(screen.getByText(/115\.84B|115,844/)).toBeInTheDocument()
  expect(screen.getByText(/\$130\.0 billion, plus or minus 3%/)).toBeInTheDocument()
})

test('shows the consensus capture time for a historical release', () => {
  const historical = filing({
    accepted_at: '2026-11-17T21:21:00Z',
    earnings_result: {
      ...RESULT,
      estimates: { ...RESULT.estimates, consensus_captured_at: '2027-01-02T19:34:00Z' },
    },
  })

  renderWithProviders(<EarningsPanel filing={historical} />)

  const comparison = within(screen.getByRole('region', { name: 'NVDA against consensus' }))
  expect(comparison.getByText(/consensus captured Jan 2, 2027, 2:34 PM ET/i)).toBeInTheDocument()
  expect(comparison.getByText(/Adjusted EPS/)).toBeInTheDocument()
  expect(comparison.getByText(/Beat/)).toBeInTheDocument()
})

test('offers the on-demand analysis for the linked filing', async () => {
  renderWithProviders(<EarningsPanel filing={filing({})} />)
  expect(await screen.findByRole('button', { name: 'Analyze' })).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/stocks/NVDA/filings/42/analysis')
})

test('no analysis button without a linked filing', () => {
  renderWithProviders(<EarningsPanel filing={filing({ filing_id: null })} />)
  expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
  expect(api.get).not.toHaveBeenCalled()
})

test('does not request analysis when the server omits the filing ID', () => {
  const { filing_id: _filingId, ...legacyFiling } = filing({ kind: 'event', earnings_result: null })

  const { container } = renderWithProviders(<EarningsPanel filing={legacyFiling} />)

  expect(api.get).not.toHaveBeenCalled()
  expect(container).toBeEmptyDOMElement()
})

test('an earnings filing our reader could not read can still be analyzed', async () => {
  renderWithProviders(<EarningsPanel filing={filing({ earnings_result: null })} />)
  expect(await screen.findByRole('button', { name: 'Analyze' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'NVDA against consensus' })).not.toBeInTheDocument()
})

test('renders nothing for a filing with neither a result nor a link', () => {
  const { container } = renderWithProviders(<EarningsPanel filing={filing({ earnings_result: null, filing_id: null })} />)
  expect(container).toBeEmptyDOMElement()
})

test('says when the saved analysis cannot be loaded', async () => {
  api.get.mockRejectedValue(new Error('404'))
  renderWithProviders(<EarningsPanel filing={filing({})} />)
  expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
})

test('keeps the saved analysis visible when a refresh fails', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  api.get.mockResolvedValue({ status: 'completed', summary: 'Demand for data center products increased.' })
  render(
    <QueryClientProvider client={queryClient}>
      <EarningsPanel filing={filing({})} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Demand for data center products increased.')).toBeInTheDocument()

  api.get.mockRejectedValue(new Error('503'))
  await act(() => queryClient.invalidateQueries({ queryKey: ['filing-analysis', 'NVDA', 42] }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not be refreshed/i)
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  expect(screen.getByText('Demand for data center products increased.')).toBeInTheDocument()
})
