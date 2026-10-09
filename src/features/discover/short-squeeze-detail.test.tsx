import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ShortSqueezeDetail } from './short-squeeze-detail'
import { useShortSqueezeDetail } from './short-squeeze-hooks'
import { conditions, squeezeDetail } from './short-squeeze.test-helpers'

vi.mock('@/features/watchlists/save-short-squeeze-setup-dialog', () => ({
  SaveShortSqueezeSetupDialog: ({ detail }: { detail: { ticker: string } }) => (
    <button type="button">Save setup for {detail.ticker}</button>
  ),
}))

vi.mock('./short-squeeze-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./short-squeeze-hooks')>()),
  useShortSqueezeDetail: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function detailReturns(data: ReturnType<typeof squeezeDetail> | undefined, extra: object = {}) {
  vi.mocked(useShortSqueezeDetail).mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...extra,
  } as never)
}

test('shows the condition checklist with dated provenance', () => {
  detailReturns(squeezeDetail())
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'SQZ · Matched conditions' })).toBeInTheDocument()
  expect(screen.getByText('Short float above 7%')).toBeInTheDocument()
  expect(screen.getByText('Days to cover above 5')).toBeInTheDocument()
  expect(screen.getByText('Daily gain above 7%')).toBeInTheDocument()
  expect(screen.getByText('Closed at or above the prior 252-session high')).toBeInTheDocument()
  // The signal close is shown against the reference it was compared with.
  expect(screen.getByText('$10.80 vs $12.00')).toBeInTheDocument()
  expect(screen.getByText(/Short-interest report date Sep 15, 2026/)).toBeInTheDocument()
  expect(screen.getByText(/Prior 252-session high \$12\.00/)).toBeInTheDocument()
  // A gain match that never reached the high gets no closing distance to it.
  expect(screen.queryByText(/the reference high/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open SQZ research' })).toHaveAttribute(
    'href',
    '/stocks/SQZ?tab=analysis',
  )
  expect(screen.queryByText(/buy now/i)).not.toBeInTheDocument()
})

test('estimated short float exposes its share counts and denominator limit', () => {
  detailReturns(squeezeDetail({
    short_float_source: 'derived_shares_short_over_float', shares_short: 6_000_000,
    float_shares: 50_000_000,
  }))
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByText(/6,000,000 shares short.*50,000,000 float shares/)).toBeInTheDocument()
  expect(screen.getByText(/current float may differ from the report-date float/)).toBeInTheDocument()
})

test('recorded outcomes separate the signal session from the measurement baseline', () => {
  detailReturns(squeezeDetail())
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'Recorded outcomes' })).toBeInTheDocument()
  expect(screen.getByText(/Signal session Oct 5, 2026/)).toBeInTheDocument()
  expect(screen.getByText(/measurement starts at the Oct 6, 2026 close/)).toBeInTheDocument()
  const row = screen.getByRole('row', { name: /1 session/ })
  expect(row).toHaveTextContent('+5.00%')
  expect(row).toHaveTextContent('+4.00%')
})

test('an unknown branch shows its reason', () => {
  detailReturns(
    squeezeDetail({
      conditions: conditions({
        high_close: { state: 'unknown', value: null, threshold: null, comparison: '>=', reason: 'high_history_incomplete' },
      }),
    }),
  )
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByText('high history incomplete')).toBeInTheDocument()
})

test('the closing distance to the prior high shows once the session reached it', () => {
  detailReturns(squeezeDetail({ high_touched: true, close_gap_to_high_pct: -8.33 }))
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByText(/Closed 8\.33% below the reference high/)).toBeInTheDocument()
})

test('a rule v1 evaluation keeps its touch condition readable', () => {
  detailReturns(
    squeezeDetail({
      conditions: conditions({
        high_close: undefined,
        high_touch: { state: 'pass', value: 12.2, threshold: 12, comparison: '>=', reason: null },
      }),
    }),
  )
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByText('Prior 252-session high touched (rule v1)')).toBeInTheDocument()
  expect(screen.getByText('$12.20 vs $12.00')).toBeInTheDocument()
})

test('a corrected source is labelled while the first match stays shown', () => {
  detailReturns(squeezeDetail({ source_corrected: true }))
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByText(/Source data changed after the first match/)).toBeInTheDocument()
  expect(screen.getByText(/First matched/)).toBeInTheDocument()
})

test('never shows the previous evaluation under a new selection', () => {
  // The cache still holds evaluation 1 (SQZ) while evaluation 2 loads.
  detailReturns(squeezeDetail({ evaluation_id: 1, ticker: 'SQZ' }), { isPending: true })
  renderWithProviders(<ShortSqueezeDetail evaluationId={2} open onOpenChange={vi.fn()} />)

  expect(screen.queryByText(/SQZ/)).not.toBeInTheDocument()
  expect(screen.getByText('Loading evidence…')).toBeInTheDocument()
  expect(useShortSqueezeDetail).toHaveBeenLastCalledWith(2)
})

test('the detail query follows the selected evaluation and idles while closed', () => {
  detailReturns(squeezeDetail())
  const { rerender } = renderWithProviders(
    <ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />,
  )
  expect(useShortSqueezeDetail).toHaveBeenLastCalledWith(1)

  rerender(<ShortSqueezeDetail evaluationId={2} open onOpenChange={vi.fn()} />)
  expect(useShortSqueezeDetail).toHaveBeenLastCalledWith(2)

  rerender(<ShortSqueezeDetail evaluationId={2} open={false} onOpenChange={vi.fn()} />)
  expect(useShortSqueezeDetail).toHaveBeenLastCalledWith(null)
})

test('an incomplete evaluation never offers to save a setup', () => {
  detailReturns(
    squeezeDetail({
      status: 'incomplete',
      observation_id: null,
      first_match: null,
      outcomes: [],
      conditions: conditions({
        high_close: { state: 'unknown', value: null, threshold: null, comparison: '>=', reason: 'high_history_incomplete' },
        price_strength: { state: 'unknown', value: null, threshold: null, comparison: 'any', reason: 'price_branch_unknown' },
      }),
    }),
  )
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /save setup/i })).not.toBeInTheDocument()
  expect(screen.getByText(/No outcome is recorded for an incomplete evaluation/)).toBeInTheDocument()
})

test('a matched evaluation offers the explicit setup save', () => {
  detailReturns(squeezeDetail())
  renderWithProviders(<ShortSqueezeDetail evaluationId={1} open onOpenChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Save setup for SQZ' })).toBeInTheDocument()
})
