import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { PriceTargetChangeBanner } from './price-target-change-banner'
import { useAnalysis } from './hooks'
import type { AnalysisOut } from '@/types/api'

vi.mock('./hooks', () => ({
  useAnalysis: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function mockAnalysis(recentPriceTargetChange: AnalysisOut['analyst_detail']) {
  vi.mocked(useAnalysis).mockReturnValue({
    data: {
      ticker: 'NVDA',
      lean: 'neutral',
      overall_score: 0,
      components: [],
      price_levels: null,
      reversal_setup: null,
      analyst_detail: recentPriceTargetChange,
      chart_pattern: null,
      caveats: [],
      generated_at: '2026-10-01T12:00:00Z',
    },
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as never)
}

test('renders nothing when there is no recent qualifying change', () => {
  mockAnalysis(null)

  const { container } = renderWithProviders(
    <PriceTargetChangeBanner ticker="NVDA" onNavigate={vi.fn()} />,
  )

  expect(container).toBeEmptyDOMElement()
})

test('renders the cut and calls onNavigate on click', () => {
  mockAnalysis({
    strong_buy: null,
    buy: null,
    hold: null,
    sell: null,
    strong_sell: null,
    price_target_low: null,
    price_target_high: null,
    price_target_mean: null,
    price_target_median: null,
    num_analysts: null,
    recent_actions: [],
    recent_price_target_change: {
      firm: 'GLJ Research',
      action_at: '2026-09-22T09:58:40Z',
      price_target_action: 'Lowers',
      current_price_target: 250.0,
      prior_price_target: 315.0,
      pct_change: -20.63,
    },
  })
  const onNavigate = vi.fn()

  renderWithProviders(<PriceTargetChangeBanner ticker="NVDA" onNavigate={onNavigate} />)

  expect(screen.getByText(/GLJ Research cut price target/)).toBeInTheDocument()
  expect(screen.getByText('$315.00 → $250.00')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button'))
  expect(onNavigate).toHaveBeenCalledOnce()
})

test('renders a raise with the correct wording', () => {
  mockAnalysis({
    strong_buy: null,
    buy: null,
    hold: null,
    sell: null,
    strong_sell: null,
    price_target_low: null,
    price_target_high: null,
    price_target_mean: null,
    price_target_median: null,
    num_analysts: null,
    recent_actions: [],
    recent_price_target_change: {
      firm: 'BMO Capital',
      action_at: '2026-08-27T18:08:30Z',
      price_target_action: 'Raises',
      current_price_target: 263.0,
      prior_price_target: 237.0,
      pct_change: 10.97,
    },
  })

  renderWithProviders(<PriceTargetChangeBanner ticker="NVDA" onNavigate={vi.fn()} />)

  expect(screen.getByText(/BMO Capital raised price target/)).toBeInTheDocument()
})
