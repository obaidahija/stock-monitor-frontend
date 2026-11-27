import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { MacroPage } from '@/pages/macro-page'
import type {
  MacroItemExplanationOut,
  MacroMovingOut,
  MacroNewsItemOut,
  SectorRotationOut,
} from '@/types/api'
import {
  useMacroExposures,
  useMacroItemExplanation,
  useMacroMoving,
  useMacroNews,
  useSectorRotation,
} from './hooks'
import { ExposurePanel } from './exposure-panel'
import { MacroItemSheet } from './macro-item-sheet'
import { MacroNewsCard } from './macro-news-card'
import { MacroNewsFeed } from './macro-news-feed'
import { SectorRead } from './sector-read'
import { WhatsMoving } from './whats-moving'

vi.mock('./hooks', () => ({
  useMacroItemExplanation: vi.fn(() => ({ data: undefined, isPending: false, isError: false })),
  useMacroExposures: vi.fn(() => ({ data: undefined, isPending: true, isError: false })),
  useMacroMoving: vi.fn(),
  useMacroNews: vi.fn(),
  useSectorRotation: vi.fn(),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.search}</div>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const ok = <T,>(data: T) =>
  ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() }) as never

const MOVING: MacroMovingOut = {
  window_hours: 24,
  items: 68,
  items_read: 68,
  relevant_items: 9,
  events: [
    {
      id: 1,
      title: 'Iran says ships hit mines in Hormuz',
      url: 'https://example.com/1',
      source: 'finnhub:general',
      published_at: '2026-11-27T12:00:00Z',
      relevance: 'high',
      magnitude: 'major',
      drivers: { oil_price: 'up', conflict_escalation: 'up' },
      also_reported: 2,
    },
  ],
  drivers: [
    {
      driver: 'oil_price',
      direction: 'up',
      events: 3,
      magnitude: 'major',
      headlines: [{ id: 1, title: 'Iran says ships hit mines in Hormuz', url: 'https://example.com/1' }],
    },
  ],
  sectors: [
    { sector: 'Energy', net: 'positive', pushes: [{ driver: 'oil_price', direction: 'up', effect: 'positive' }] },
  ],
  caveat: 'context only',
  generated_at: '2026-11-27T12:05:00Z',
}

const ROTATION: SectorRotationOut = {
  window_days: 5,
  as_of: '2026-11-27',
  prior_as_of: '2026-11-22',
  history_days_available: 30,
  caveat: '',
  sectors: [
    { etf_symbol: 'XLK', sector: 'Technology', trend_pct: 4.2, rank: 1, trend_pct_prior: 3, rank_prior: 2, rank_change: 1, trend_pct_change: 1.2 },
    { etf_symbol: 'XLE', sector: 'Energy', trend_pct: -1.5, rank: 9, trend_pct_prior: -2, rank_prior: 10, rank_change: 1, trend_pct_change: 0.5 },
  ],
}

test("what's moving shows drivers, events and how much was filtered as noise", () => {
  vi.mocked(useMacroMoving).mockReturnValue(ok(MOVING))
  renderWithProviders(<WhatsMoving />)

  expect(screen.getByText('9 relevant of 68 macro headlines — the rest was filtered as noise.')).toBeInTheDocument()
  expect(screen.getByText('· 3')).toBeInTheDocument()
  expect(screen.getByText('Iran says ships hit mines in Hormuz')).toBeInTheDocument()
  expect(screen.getByText('+2 similar')).toBeInTheDocument()
  expect(screen.getByText('Major')).toBeInTheDocument()
})

test('sector read puts sectors with news pressure first, beside momentum', () => {
  vi.mocked(useMacroMoving).mockReturnValue(ok(MOVING))
  vi.mocked(useSectorRotation).mockReturnValue(ok(ROTATION))
  renderWithProviders(<SectorRead />)

  const rows = screen.getAllByRole('row').slice(1)
  expect(rows[0]).toHaveTextContent('Energy')
  expect(rows[0]).toHaveTextContent('Tailwind')
  expect(rows[0]).toHaveTextContent('-1.5%')
  expect(rows[1]).toHaveTextContent('Technology')
  expect(rows[1]).toHaveTextContent('—')
})

test('the feed asks for relevant items by default and can show everything', async () => {
  const user = userEvent.setup()
  vi.mocked(useMacroNews).mockReturnValue(ok([]))
  renderWithProviders(<MacroNewsFeed />)

  expect(vi.mocked(useMacroNews)).toHaveBeenLastCalledWith({ hours: 24, relevantOnly: true })
  await user.click(screen.getByRole('button', { name: 'Relevant only' }))
  expect(vi.mocked(useMacroNews)).toHaveBeenLastCalledWith({ hours: 24, relevantOnly: false })
})

test('a news card shows the drivers the model read, or marks noise', () => {
  const base = {
    id: 1,
    source: 'rss:cnbc_top_news',
    url: 'https://example.com/a',
    title: 'Fed raises rates',
    summary: null,
    categories: [],
    sentiment_label: null,
    sentiment_score: null,
    published_at: '2026-11-27T12:00:00Z',
    classification_pending: false,
  } satisfies MacroNewsItemOut
  renderWithProviders(
    <>
      <MacroNewsCard item={{ ...base, model_relevant: true, model_drivers: { rates_policy: 'up' } }} />
      <MacroNewsCard item={{ ...base, id: 2, title: 'Chef opens restaurant', model_relevant: false, model_drivers: {} }} />
      <MacroNewsCard item={{ ...base, id: 3, title: 'Unread', model_relevant: null }} />
    </>,
  )

  expect(screen.getByText('Fed / rates')).toBeInTheDocument()
  expect(screen.getByText('Not market-moving')).toBeInTheDocument()
  expect(screen.getByText('Reading…')).toBeInTheDocument()
})


const EXPLANATION: MacroItemExplanationOut = {
  item: {
    id: 1,
    source: 'rss:cnbc_top_news',
    url: 'https://example.com/1',
    title: 'Treasury yields jump after hot payrolls',
    summary: 'The 10-year yield rose to 4.7%.',
    categories: [],
    sentiment_label: null,
    sentiment_score: null,
    published_at: '2026-11-27T12:00:00Z',
    classification_pending: false,
  },
  relevance: 'high',
  relevant: true,
  p_relevant: 0.96,
  relevance_probabilities: { none: 0.01, low: 0.03, medium: 0.2, high: 0.76 },
  relevance_threshold: 0.25,
  magnitude: 'notable',
  drivers: { treasury_yields: 'up' },
  driver_details: [
    { driver: 'treasury_yields', direction: 'up', confidence: 0.86, evidence: 'The 10-year yield rose to 4.7%.' },
  ],
  sector_effects: [
    {
      sector: 'Utilities',
      net: 'negative',
      because: [
        {
          driver: 'treasury_yields',
          direction: 'up',
          effect: 'negative',
          reason: 'Dividend stocks lose appeal against higher bond yields.',
          agree: 15,
          cases: 15,
        },
      ],
    },
  ],
  model_version: 'macro-v1',
  caveat: 'Context only.',
}

test('a market wrap says so in its panel and on its card', () => {
  vi.mocked(useMacroItemExplanation).mockReturnValue(ok({ ...EXPLANATION, market_wrap: true }))
  renderWithProviders(<MacroItemSheet itemId={1} onOpenChange={vi.fn()} />)
  expect(screen.getByText('Market wrap.')).toBeInTheDocument()
  cleanup()
  renderWithProviders(<MacroNewsCard item={{ ...EXPLANATION.item, market_wrap: true, model_relevant: true }} />)
  expect(screen.getByText('Market wrap')).toBeInTheDocument()
})

test('a long summary shows a written overview, with the full text folded away', () => {
  vi.mocked(useMacroItemExplanation).mockReturnValue(
    ok({
      ...EXPLANATION,
      item: { ...EXPLANATION.item, summary: 'Very long run-on wrap text …' },
      overview: { text: 'Stocks rebound and gold rises.', method: 'bart-large-cnn', unsupported_numbers: [] },
    }),
  )
  renderWithProviders(<MacroItemSheet itemId={1} onOpenChange={vi.fn()} />)

  expect(screen.getByText('Overview')).toBeInTheDocument()
  expect(screen.getByText('Stocks rebound and gold rises.')).toBeInTheDocument()
  expect(screen.getByText('Show the full feed summary')).toBeInTheDocument()
})

test('the item panel explains relevance, drivers with evidence, and sector rules', () => {
  vi.mocked(useMacroItemExplanation).mockReturnValue(ok(EXPLANATION))
  renderWithProviders(<MacroItemSheet itemId={1} onOpenChange={vi.fn()} />)

  expect(screen.getByText('High relevance to US stocks')).toBeInTheDocument()
  expect(screen.getByText('86% confident')).toBeInTheDocument()
  expect(screen.getByText('“The 10-year yield rose to 4.7%.”')).toBeInTheDocument()
  expect(screen.getByText('Headwind')).toBeInTheDocument()
  expect(screen.getByText('Dividend stocks lose appeal against higher bond yields.')).toBeInTheDocument()
  expect(screen.getByText('· labelled data agreed 15/15')).toBeInTheDocument()
})

test('clicking anywhere on an event puts its id in the URL', async () => {
  const user = userEvent.setup()
  vi.mocked(useMacroMoving).mockReturnValue(ok(MOVING))
  renderWithProviders(
    <>
      <WhatsMoving />
      <LocationProbe />
    </>,
  )

  // the source line, not the headline
  await user.click(screen.getByText('+2 similar'))

  expect(screen.getByTestId('location')).toHaveTextContent('?item=1')
})

test('the Macro page opens the panel from ?item= on load, so a refresh keeps it open', () => {
  vi.mocked(useMacroMoving).mockReturnValue(ok(MOVING))
  vi.mocked(useSectorRotation).mockReturnValue(ok(ROTATION))
  vi.mocked(useMacroNews).mockReturnValue(ok([]))
  vi.mocked(useMacroItemExplanation).mockReturnValue(ok(EXPLANATION))
  renderWithProviders(<MacroPage />, ['/macro?item=1'])

  expect(vi.mocked(useMacroItemExplanation)).toHaveBeenLastCalledWith(1)
  expect(screen.getByRole('dialog')).toHaveTextContent('High relevance to US stocks')
})


const EXPOSURE = {
  driver: 'oil',
  direction: 'up' as const,
  typical_driver_move: 2.1,
  industries: {
    hurt: [{ industry: 'Airlines', sector: 'Industrials', members: 6, typical_move_pp: -1.0, consistency: 1, significant: 6 }],
    helped: [{ industry: 'Oil & Gas E&P', sector: 'Energy', members: 16, typical_move_pp: 1.3, consistency: 1, significant: 16 }],
  },
  stocks: {
    hurt: [{ ticker: 'AAL', industry: 'Airlines', sector: 'Industrials', typical_move_pp: -1.15, t: -6.1 }],
    helped: [{ ticker: 'XOM', industry: 'Oil & Gas Integrated', sector: 'Energy', typical_move_pp: 1.1, t: 9.0 }],
  },
  significant_stocks: 223,
  computed_at: '2026-11-27T12:00:00Z',
  window_start: '2025-11-28',
  window_end: '2026-11-27',
  tickers: 980,
  caveat: 'Same-day reactions, not a forecast.',
}

test('the exposure panel lists hurt and helped industries and stocks', () => {
  vi.mocked(useMacroExposures).mockReturnValue(ok(EXPOSURE))
  renderWithProviders(<ExposurePanel driver="oil" direction="up" />)

  expect(screen.getByText('Airlines')).toBeInTheDocument()
  expect(screen.getByText('-1.00pp')).toBeInTheDocument()
  expect(screen.getByText('Oil & Gas E&P')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /AAL/ })).toHaveAttribute('href', '/stocks/AAL')
  expect(screen.getByText(/980 stocks/)).toBeInTheDocument()
})

test('clicking a driver chip opens who it moves, measured', async () => {
  const user = userEvent.setup()
  vi.mocked(useMacroMoving).mockReturnValue(ok(MOVING))
  vi.mocked(useMacroExposures).mockReturnValue(ok(EXPOSURE))
  renderWithProviders(<WhatsMoving />)

  await user.click(screen.getByRole('button', { name: /Oil/ }))

  expect(screen.getByText('Most exposed (measured)')).toBeInTheDocument()
  expect(vi.mocked(useMacroExposures)).toHaveBeenLastCalledWith('oil', 'up')
})

test('drivers without a market measure (e.g. conflict) render as plain chips', () => {
  vi.mocked(useMacroMoving).mockReturnValue(
    ok({
      ...MOVING,
      drivers: [
        { driver: 'conflict_escalation', direction: 'up', events: 2, magnitude: 'notable', headlines: [] },
        ...MOVING.drivers,
      ],
    }),
  )
  renderWithProviders(<WhatsMoving />)

  expect(screen.getAllByText('Conflict').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /Conflict/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Oil/ })).toHaveAttribute('aria-pressed', 'false')
})

test('a sector opens into its industries, and a mixed sector points to them', async () => {
  const user = userEvent.setup()
  const industry = (name: string, sector: string, move: number) => ({
    sector,
    industry: name,
    members: 6,
    net: move > 0 ? ('positive' as const) : ('negative' as const),
    typical_move_pp: move,
    pushes: [{ driver: 'oil', direction: 'up' as const, effect: move > 0 ? ('positive' as const) : ('negative' as const), typical_move_pp: move, consistency: 1 }],
  })
  vi.mocked(useMacroMoving).mockReturnValue(
    ok({
      ...MOVING,
      sector_basis: 'measured',
      sectors: [],
      industries: [
        industry('Airlines', 'Technology', -1.0),
        industry('Waste Management', 'Technology', 0.4),
        ...['A', 'B', 'C'].map((n) => industry(`Industry ${n}`, 'Technology', -0.1)),
      ],
    }),
  )
  vi.mocked(useSectorRotation).mockReturnValue(ok(ROTATION))
  renderWithProviders(<SectorRead />)

  expect(screen.getByText('Mixed at sector level — see its industries')).toBeInTheDocument()
  expect(screen.queryByText('Airlines')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Technology/ }))

  expect(screen.getByText('Airlines')).toBeInTheDocument()
  expect(screen.getByText('-1.00pp')).toBeInTheDocument()
  expect(screen.queryByText('Industry C')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Show all 5 industries' }))
  expect(screen.getByText('Industry C')).toBeInTheDocument()
})
