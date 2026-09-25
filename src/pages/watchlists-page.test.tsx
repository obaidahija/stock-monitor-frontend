import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { WatchlistItemOut } from '@/types/api'
import { renderWithProviders } from '@/test/render'
import { WatchlistsPage } from './watchlists-page'

const items: WatchlistItemOut[] = [
  {
    id: 10,
    watchlist_id: 1,
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    created_at: '2026-08-01T12:00:00Z',
    current_price: 225.01,
    session_price: 225.13,
    quote_updated_at: '2026-08-17T23:59:59Z',
    market_session: 'overnight',
    distance_pct: {
      entry_primary: 0,
      entry_secondary: -5,
      stop_loss: -10,
      take_profit: 20,
    },
    current_setup: {
      id: 20,
      watchlist_item_id: 10,
      ticker: 'NVDA',
      side: 'long',
      horizon: 'short_term',
      expires_on: '2026-08-16',
      source_mode: 'ai_managed',
      status: 'expired',
      is_current: true,
      entry_primary: 100,
      entry_secondary: 95,
      stop_loss: 90,
      take_profit: 120,
      note: null,
      research_snapshot_id: 3,
      levels_snapshot_id: 2,
      needs_review: true,
      sync_error: 'New levels conflict with the long side.',
      research: {
        snapshot_id: 3,
        score: 72,
        confidence: 78,
        lean: 'bullish',
        summary: 'Strong fundamentals with an important earnings catalyst ahead.',
        key_drivers: [],
        risks: [],
        price_reference_note: null,
        generated_at: '2026-08-17T12:00:00Z',
      },
      created_at: '2026-08-01T12:00:00Z',
      updated_at: '2026-08-17T12:00:00Z',
      superseded_at: null,
    },
    event_count: 1,
    active_event_count: 1,
    has_event_delivery_failure: false,
  },
  {
    id: 11,
    watchlist_id: 1,
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    created_at: '2026-08-02T12:00:00Z',
    current_price: 200,
    session_price: 197.5,
    quote_updated_at: '2026-08-17T12:00:00Z',
    market_session: 'post_market',
    distance_pct: null,
    current_setup: null,
    event_count: 0,
    active_event_count: 0,
    has_event_delivery_failure: false,
  },
]

const itemState = vi.hoisted(() => ({ override: null as unknown }))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: {
      swing_research_enabled: true,
      research_outcomes_v2_enabled: false,
      catalyst_scanner_enabled: false,
      follow_through_enabled: false,
      event_window_v2_enabled: false,
      research_intraday_enabled: false,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSetupWindowPreview: () => ({ data: undefined, isPending: false, isError: false }),
}))

vi.mock('@/features/watchlists/hooks', () => ({
  useWatchlists: () => ({ data: [{ id: 1, name: 'Watchlist', item_count: 2 }], isPending: false }),
  useWatchlistItems: () => ({
    data: itemState.override ?? items,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateWatchlist: () => ({ mutateAsync: vi.fn() }),
  useRenameWatchlist: () => ({ mutateAsync: vi.fn() }),
  useDeleteWatchlist: () => ({ mutateAsync: vi.fn() }),
  useRemoveWatchlistItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateManualSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateWatchlistSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetupHistory: () => ({ data: [], isPending: false }),
  useCloneSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useWatchlistEvents: () => ({ data: [], isPending: false }),
  useTelegramStatus: () => ({ data: { configured: true, ready: true }, isPending: false }),
  useCreateWatchlistEvent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateWatchlistEvent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRearmWatchlistEvent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteWatchlistEvent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRetryWatchlistEventDelivery: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendTelegramTest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

afterEach(() => {
  cleanup()
  itemState.override = null
})

test('keeps expired and favorite-only tickers visible and surfaces review state', () => {
  renderWithProviders(<WatchlistsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Expand NVDA details' }))
  fireEvent.click(screen.getByRole('button', { name: 'Expand AAPL details' }))
  expect(screen.getByText(/expired/i)).toBeTruthy()
  expect(screen.getByText('Needs review')).toBeTruthy()
  expect(screen.getByText(/saved as a favorite without a price setup/i)).toBeTruthy()
  expect(screen.getByText('New levels conflict with the long side.')).toBeTruthy()
})

test('renders the price-level table with setup actions', () => {
  renderWithProviders(<WatchlistsPage />)

  expect(screen.getByRole('columnheader', { name: 'Ticker' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Price' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Primary entry' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Secondary entry' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Take profit' })).toBeTruthy()
  expect(screen.getByText('NVIDIA Corporation')).toBeTruthy()
  expect(screen.getByText('Overnight')).toBeTruthy()
  expect(screen.getByText('Post')).toBeTruthy()
  expect(screen.getByText('$225.01')).toBeTruthy()
  expect(screen.getByText('$225.13')).toBeTruthy()
  expect(screen.getByText('Closed: Aug 17, 7:59 PM ET')).toBeTruthy()
  expect(screen.getByText(/\+0\.12 \(\+0\.053%\)/).className).toContain('text-emerald-600')
  expect(screen.getByText(/-2\.50 \(-1\.25%\)/).className).toContain('text-red-600')
  expect(screen.getByText('$120.00')).toBeTruthy()
  expect(screen.getByText('-5.00% from current')).toBeTruthy()
  expect(screen.getByText('+20.00% from current')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Edit setup' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create setup' })).toBeTruthy()
})

test('expands a table row to show setup details', () => {
  renderWithProviders(<WatchlistsPage />)

  fireEvent.click(screen.getByRole('button', { name: 'Expand NVDA details' }))

  expect(screen.getByText('Stop loss')).toBeTruthy()
  expect(screen.getByText('$90.00')).toBeTruthy()
  expect(screen.getByText('2026-08-16')).toBeTruthy()
  expect(screen.getByText('New levels conflict with the long side.')).toBeTruthy()
  expect(screen.getByText('AI explanation')).toBeTruthy()
  expect(screen.getByText('72')).toBeTruthy()
  expect(screen.getByText('78% confidence')).toBeTruthy()
  const collapseButton = screen.getByRole('button', { name: 'Collapse NVDA details' })
  expect(collapseButton).toBeTruthy()

  fireEvent.click(collapseButton)
  expect(screen.queryByText('Stop loss')).toBeNull()
})

test('shows a swing setup as a session window with its exact exchange expiry', () => {
  const swingItem: WatchlistItemOut = {
    ...items[1],
    id: 12,
    ticker: 'AMD',
    company_name: 'Advanced Micro Devices',
    distance_pct: null,
    current_setup: {
      ...items[0].current_setup!,
      id: 21,
      watchlist_item_id: 12,
      ticker: 'AMD',
      horizon: 'swing',
      horizon_sessions: 3,
      window: {
        starts_at: '2026-09-21T12:00:00Z',
        anchor_session: '2026-09-21',
        horizon_sessions: 3,
        expires_at: '2026-09-23T20:00:00Z',
        expires_on: '2026-09-23',
        calendar: 'XNYS',
        window_version: 'swing-window-v1',
      },
      expires_on: '2026-09-23',
      status: 'active',
      needs_review: false,
      sync_error: null,
      research: null,
    },
  }
  itemState.override = [swingItem]
  renderWithProviders(<WatchlistsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Expand AMD details' }))

  expect(screen.getByText('Swing · 3 trading sessions')).toBeTruthy()
  expect(screen.getByText('Wed, Sep 23, 4:00 PM ET')).toBeTruthy()
})
