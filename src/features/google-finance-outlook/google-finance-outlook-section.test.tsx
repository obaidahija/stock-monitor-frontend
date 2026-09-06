import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { GoogleFinanceMarketPickOut, GoogleFinanceMarketPicksOut } from '@/types/api'
import { GoogleFinanceOutlookSection } from './google-finance-outlook-section'

const hooks = vi.hoisted(() => ({
  useGoogleFinanceMarketPicks: vi.fn(),
  useRefreshGoogleFinanceMarketPicks: vi.fn(),
}))

vi.mock('./hooks', () => hooks)

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function pick(overrides: Partial<GoogleFinanceMarketPickOut> = {}): GoogleFinanceMarketPickOut {
  return {
    rank: 1,
    ticker: 'AAPL',
    company_name_reported: 'Apple Inc.',
    conviction_score: 82,
    explanation: 'Strong iPhone cycle momentum.',
    tracked: true,
    composite_score: 71,
    lean: 'bullish',
    sector: 'Technology',
    current_price: 232.5,
    change_pct: 1.2,
    market_cap: 3_500_000_000_000,
    ...overrides,
  }
}

function snapshot(
  overrides: Partial<GoogleFinanceMarketPicksOut> = {},
): GoogleFinanceMarketPicksOut {
  return {
    horizons: [
      {
        horizon: '1-2w',
        horizon_label: '1-2 weeks',
        source_ok: true,
        source_error: null,
        fetched_at: '2026-09-05T10:00:00Z',
        parse_warning: null,
        items: [pick()],
        sources: [],
      },
      {
        horizon: '2-4w',
        horizon_label: '2-4 weeks',
        source_ok: true,
        source_error: null,
        fetched_at: '2026-09-05T10:00:00Z',
        parse_warning: null,
        items: [],
        sources: [],
      },
    ],
    generated_at: '2026-09-05T10:00:00Z',
    refresh_active: false,
    active_run_id: null,
    stale: false,
    stale_reason: null,
    disclaimer: 'Speculative, AI-generated stock-direction guesses. Not financial advice.',
    ...overrides,
  }
}

function setQueryState(overrides: Record<string, unknown> = {}) {
  hooks.useGoogleFinanceMarketPicks.mockReturnValue({
    data: snapshot(),
    isPending: false,
    isError: false,
    ...overrides,
  })
}

beforeEach(() => {
  hooks.useGoogleFinanceMarketPicks.mockReset()
  hooks.useRefreshGoogleFinanceMarketPicks.mockReset()
  hooks.useRefreshGoogleFinanceMarketPicks.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  })
  navigateMock.mockReset()
  setQueryState()
})

afterEach(cleanup)

test('shows a loading skeleton while pending', () => {
  setQueryState({ data: undefined, isPending: true })
  const { container } = renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})

test('renders nothing when every horizon is empty (disabled/never-run default state)', () => {
  setQueryState({
    data: snapshot({
      horizons: snapshot().horizons.map((h) => ({ ...h, items: [] })),
      stale: true,
      stale_reason: 'not_generated',
    }),
  })
  const { container } = renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(container).toBeEmptyDOMElement()
})

test('renders nothing on a network error', () => {
  setQueryState({ data: undefined, isError: true })
  const { container } = renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(container).toBeEmptyDOMElement()
})

test('renders 2 horizon tabs and switches the visible list on click', async () => {
  const user = userEvent.setup()
  const data = snapshot()
  data.horizons[1].items = [pick({ ticker: 'MSFT', company_name_reported: 'Microsoft Corp.' })]
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(screen.getByRole('tab', { name: '1-2 weeks' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '2-4 weeks' })).toBeInTheDocument()
  expect(screen.getByText('AAPL')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: '2-4 weeks' }))

  expect(await screen.findByText('MSFT')).toBeInTheDocument()
})

test('the pill only shows the ticker and score -- reasoning is not visible until hovered', () => {
  const data = snapshot()
  data.horizons[0].items = [
    pick({ ticker: 'AAPL', explanation: 'Strong iPhone cycle momentum. Should be tooltip-only.' }),
  ]
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(screen.getByRole('button', { name: /AAPL/ })).toBeInTheDocument()
  expect(screen.queryByText(/Should be tooltip-only/)).not.toBeInTheDocument()
})

test('hovering a pill reveals the explanation and MarketScout enrichment in a tooltip', async () => {
  const user = userEvent.setup()
  const data = snapshot()
  data.horizons[0].items = [pick({ ticker: 'AAPL', explanation: 'Strong iPhone cycle momentum.' })]
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  await user.hover(screen.getByRole('button', { name: /AAPL/ }))

  expect(await screen.findByText('Strong iPhone cycle momentum.')).toBeInTheDocument()
  expect(screen.getByText(/MarketScout score/)).toBeInTheDocument()
})

test('clicking an untracked pick still navigates to its ticker page', async () => {
  const user = userEvent.setup()
  const data = snapshot()
  data.horizons[0].items = [pick({ ticker: 'EVGO', tracked: false })]
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  await user.click(screen.getByRole('button', { name: /EVGO/ }))

  expect(navigateMock).toHaveBeenCalledWith('/stocks/EVGO')
})

test("an untracked pick's tooltip omits the MarketScout enrichment line", async () => {
  const user = userEvent.setup()
  const data = snapshot()
  data.horizons[0].items = [
    pick({
      ticker: 'ZZZZ',
      tracked: false,
      explanation: 'Speculative momentum play.',
      composite_score: null,
      sector: null,
      current_price: null,
      change_pct: null,
    }),
  ]
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  await user.hover(screen.getByRole('button', { name: /ZZZZ/ }))

  expect(await screen.findByText('Speculative momentum play.')).toBeInTheDocument()
  expect(screen.queryByText(/MarketScout score/)).not.toBeInTheDocument()
})

test('a horizon with source_ok false shows an empty state instead of crashing', async () => {
  const user = userEvent.setup()
  const data = snapshot()
  data.horizons[1] = {
    ...data.horizons[1],
    source_ok: false,
    source_error: 'Google Finance page changed',
    items: [],
  }
  setQueryState({ data })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  await user.click(screen.getByRole('tab', { name: '2-4 weeks' }))

  expect(
    await screen.findByText("Google Finance couldn't produce an outlook for 2-4 weeks today."),
  ).toBeInTheDocument()
})

test('refresh button disables while a refresh is in flight', () => {
  hooks.useRefreshGoogleFinanceMarketPicks.mockReturnValue({ mutate: vi.fn(), isPending: true })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
})

test('clicking refresh triggers the mutation', async () => {
  const user = userEvent.setup()
  const mutate = vi.fn()
  hooks.useRefreshGoogleFinanceMarketPicks.mockReturnValue({ mutate, isPending: false })
  renderWithProviders(<GoogleFinanceOutlookSection />)

  await user.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(mutate).toHaveBeenCalledTimes(1)
})
