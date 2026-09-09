import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { MarketEventBigEarningsOut, MarketEventOut, MarketEventsOut } from '@/types/api'
import { MarketEventsList } from './market-events-list'

const hooks = vi.hoisted(() => ({
  useMarketEvents: vi.fn(),
  useRefreshMarketEvents: vi.fn(),
}))

vi.mock('./hooks', () => hooks)

function isoDateDaysFromNow(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function event(overrides: Partial<MarketEventOut> = {}): MarketEventOut {
  return {
    rank: 1,
    event_name: 'FOMC rate decision',
    event_date: isoDateDaysFromNow(3),
    category: 'rates_fed',
    stance: 'hawkish',
    reason: 'Markets expect a hold with hawkish tone.',
    sector_impacts: [
      {
        sector: 'Real Estate',
        rationale: 'REITs are high-duration and rate-sensitive.',
        predicted_direction: 'negative',
        via_category: null,
        current_trend_pct: -1.2,
        graded: false,
        actual_direction: null,
        hit: null,
        trend_pct_before: null,
        trend_pct_after: null,
      },
    ],
    ...overrides,
  }
}

function bigEarnings(overrides: Partial<MarketEventBigEarningsOut> = {}): MarketEventBigEarningsOut {
  return {
    ticker: 'ORCL',
    sector: 'Technology',
    event_date: isoDateDaysFromNow(2),
    bmo_amc: 'amc',
    market_cap: 614_000_000_000,
    ...overrides,
  }
}

function snapshot(overrides: Partial<MarketEventsOut> = {}): MarketEventsOut {
  return {
    events: [event()],
    big_earnings: [],
    generated_at: '2026-09-09T10:00:00Z',
    refresh_active: false,
    active_run_id: null,
    stale: false,
    stale_reason: null,
    source_error: null,
    parse_warning: null,
    disclaimer: 'Speculative, AI-generated read. Not financial advice.',
    outcome_caveat: 'trend_pct is a trailing 20-day return, not a precise return.',
    ...overrides,
  }
}

function setQueryState(overrides: Record<string, unknown> = {}) {
  hooks.useMarketEvents.mockReturnValue({
    data: snapshot(),
    isPending: false,
    isError: false,
    ...overrides,
  })
}

beforeEach(() => {
  hooks.useMarketEvents.mockReset()
  hooks.useRefreshMarketEvents.mockReset()
  hooks.useRefreshMarketEvents.mockReturnValue({ mutate: vi.fn(), isPending: false })
  setQueryState()
})

afterEach(cleanup)

test('shows a loading state while pending', () => {
  setQueryState({ data: undefined, isPending: true })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

test('shows an error state on a network error', () => {
  setQueryState({ data: undefined, isError: true, error: new Error('boom') })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('boom')).toBeInTheDocument()
})

test('shows a not-generated-yet message when stale with nothing on the calendar', () => {
  setQueryState({
    data: snapshot({ events: [], big_earnings: [], stale: true, stale_reason: 'not_generated' }),
  })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText(/No macro events generated yet/)).toBeInTheDocument()
})

test('shows a nothing-on-the-calendar message for a date with no events or earnings', () => {
  setQueryState({ data: snapshot({ events: [], big_earnings: [], stale: false }) })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('Nothing on the calendar for this date.')).toBeInTheDocument()
})

test('big earnings still render even when the macro scan is stale/empty', () => {
  setQueryState({
    data: snapshot({ events: [], big_earnings: [bigEarnings()], stale: true }),
  })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('ORCL')).toBeInTheDocument()
  expect(screen.getByText(/only big earnings are shown/)).toBeInTheDocument()
})

test('renders summary stats derived from events and big earnings', () => {
  setQueryState({ data: snapshot({ big_earnings: [bigEarnings()] }) })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('Macro events')).toBeInTheDocument()
  expect(screen.getByText('Big earnings')).toBeInTheDocument()
  expect(screen.getByText('Next up')).toBeInTheDocument()
  // Default fixture's sector impact predicts a negative move.
  expect(screen.getByText('0 up / 1 down')).toBeInTheDocument()
  expect(screen.getByText('None yet')).toBeInTheDocument()
})

test('groups events under a day header showing weekday, date and urgency', () => {
  setQueryState({ data: snapshot({ events: [event({ event_date: isoDateDaysFromNow(0) })] }) })
  renderWithProviders(<MarketEventsList />)

  const today = new Date()
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
  // The day header renders "{Weekday}, {Mon DD}" -- unique to the header,
  // unlike the "Today" urgency label which also appears in the stats tile.
  expect(screen.getByText(new RegExp(`^${weekday},`))).toBeInTheDocument()
  expect(screen.getAllByText('Today').length).toBeGreaterThan(0)
})

test('a macro event and a big-earnings item on the same day share one day group', () => {
  const sameDay = isoDateDaysFromNow(4)
  setQueryState({
    data: snapshot({
      events: [event({ event_date: sameDay })],
      big_earnings: [bigEarnings({ event_date: sameDay })],
    }),
  })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getAllByText(/^\w+day, /).length).toBe(1)
  expect(screen.getByRole('button', { name: /FOMC rate decision/ })).toBeInTheDocument()
  expect(screen.getByText('ORCL')).toBeInTheDocument()
})

test('the first day group is expanded by default, showing category and stance explanations', () => {
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByRole('button', { name: /FOMC rate decision/ })).toBeInTheDocument()
  expect(screen.getByText('Rates & Fed')).toBeInTheDocument()
  // Stance badge is deliberately framed as a lean, not a positive/negative call.
  expect(screen.getByText('Hawkish lean')).toBeInTheDocument()
  // Expanded by default -- explanatory text is visible without an extra click.
  expect(screen.getByText(/single biggest lever on borrowing costs/)).toBeInTheDocument()
  expect(screen.getByText(/more restrictive, risk-off outcome/)).toBeInTheDocument()
})

test('collapsing and re-expanding an event toggles its detail', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketEventsList />)

  const toggle = screen.getByRole('button', { name: /FOMC rate decision/ })
  expect(screen.getByText('Likely sector impact')).toBeInTheDocument()

  await user.click(toggle)
  expect(screen.queryByText('Likely sector impact')).not.toBeInTheDocument()

  await user.click(toggle)
  expect(await screen.findByText('Likely sector impact')).toBeInTheDocument()
})

test('renders sector-impact rationale and a not-graded-yet outcome note when expanded', () => {
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('REITs are high-duration and rate-sensitive.')).toBeInTheDocument()
  expect(screen.getByText(/not graded yet/)).toBeInTheDocument()
})

test('a hit is shown with a moved-as-predicted note', () => {
  setQueryState({
    data: snapshot({
      events: [
        event({
          sector_impacts: [
            {
              sector: 'Real Estate',
              rationale: 'REITs are high-duration and rate-sensitive.',
              predicted_direction: 'negative',
              via_category: null,
              current_trend_pct: -3.0,
              graded: true,
              actual_direction: 'negative',
              hit: true,
              trend_pct_before: -1.0,
              trend_pct_after: -3.0,
            },
          ],
        }),
      ],
    }),
  })
  renderWithProviders(<MarketEventsList />)

  // Scoped with the percentages so it doesn't also match the "how this
  // works" explainer's generic mention of the same phrase.
  expect(screen.getByText(/moved as predicted \(-1\.0% → -3\.0%\)/)).toBeInTheDocument()
})

test('a miss is shown with a moved-opposite note', () => {
  setQueryState({
    data: snapshot({
      events: [
        event({
          sector_impacts: [
            {
              sector: 'Real Estate',
              rationale: 'REITs are high-duration and rate-sensitive.',
              predicted_direction: 'negative',
              via_category: null,
              current_trend_pct: 3.0,
              graded: true,
              actual_direction: 'positive',
              hit: false,
              trend_pct_before: -1.0,
              trend_pct_after: 3.0,
            },
          ],
        }),
      ],
    }),
  })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText(/moved the opposite way \(-1\.0% → 3\.0%\)/)).toBeInTheDocument()
})

test('an event with no sector impacts explains there is no mapping instead of crashing', () => {
  setQueryState({ data: snapshot({ events: [event({ sector_impacts: [] })] }) })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByRole('button', { name: /FOMC rate decision/ })).toBeInTheDocument()
  expect(screen.getByText(/No sector transmission mapped/)).toBeInTheDocument()
})

test('a big-earnings card shows ticker, sector, BMO/AMC timing and compact market cap', () => {
  setQueryState({ data: snapshot({ big_earnings: [bigEarnings()] }) })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText('ORCL')).toBeInTheDocument()
  expect(screen.getByText('Earnings')).toBeInTheDocument()
  expect(screen.getByText('Technology')).toBeInTheDocument()
  // Rendered lowercase in the DOM; CSS `uppercase` only changes the display.
  expect(screen.getByText('amc')).toBeInTheDocument()
  expect(screen.getByText('$614B')).toBeInTheDocument()
})

test('renders a collapsible "how this calendar is built" explainer, expanded by default', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketEventsList />)

  const heading = screen.getByRole('button', { name: /How this calendar is built/ })
  expect(screen.getByText(/hand-authored sector transmission rules/)).toBeInTheDocument()
  expect(screen.getByText(/deliberately not asked of Google Finance at all/)).toBeInTheDocument()

  await user.click(heading)
  expect(screen.queryByText(/hand-authored sector transmission rules/)).not.toBeInTheDocument()
})

test('renders the disclaimer and outcome caveat', () => {
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByText(/Speculative, AI-generated read/)).toBeInTheDocument()
  expect(screen.getByText(/trailing 20-day return/)).toBeInTheDocument()
})

test('refresh button disables while a refresh is in flight', () => {
  hooks.useRefreshMarketEvents.mockReturnValue({ mutate: vi.fn(), isPending: true })
  renderWithProviders(<MarketEventsList />)

  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
})

test('clicking refresh triggers the mutation', async () => {
  const user = userEvent.setup()
  const mutate = vi.fn()
  hooks.useRefreshMarketEvents.mockReturnValue({ mutate, isPending: false })
  renderWithProviders(<MarketEventsList />)

  await user.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(mutate).toHaveBeenCalledTimes(1)
})
