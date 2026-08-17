import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { WatchlistItemOut } from '@/types/api'
import { WatchlistsPage } from './watchlists-page'

const items: WatchlistItemOut[] = [
  {
    id: 10,
    watchlist_id: 1,
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    created_at: '2026-08-01T12:00:00Z',
    current_price: 100,
    quote_updated_at: '2026-08-17T12:00:00Z',
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
  },
  {
    id: 11,
    watchlist_id: 1,
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    created_at: '2026-08-02T12:00:00Z',
    current_price: 200,
    quote_updated_at: null,
    distance_pct: null,
    current_setup: null,
  },
]

vi.mock('@/features/watchlists/hooks', () => ({
  useWatchlists: () => ({ data: [{ id: 1, name: 'Watchlist', item_count: 2 }], isPending: false }),
  useWatchlistItems: () => ({ data: items, isPending: false, isError: false, refetch: vi.fn() }),
  useCreateWatchlist: () => ({ mutateAsync: vi.fn() }),
  useRenameWatchlist: () => ({ mutateAsync: vi.fn() }),
  useDeleteWatchlist: () => ({ mutateAsync: vi.fn() }),
  useRemoveWatchlistItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateManualSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateWatchlistSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetupHistory: () => ({ data: [], isPending: false }),
  useCloneSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

afterEach(cleanup)

test('keeps expired and favorite-only tickers visible and surfaces review state', () => {
  render(<MemoryRouter><WatchlistsPage /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Detailed view' }))
  expect(screen.getByText(/expired/i)).toBeTruthy()
  expect(screen.getByText('Needs review')).toBeTruthy()
  expect(screen.getByText('Favorite only')).toBeTruthy()
  expect(screen.getByText('New levels conflict with the long side.')).toBeTruthy()
})

test('switches to a simple price-level table', () => {
  render(<MemoryRouter><WatchlistsPage /></MemoryRouter>)

  expect(screen.getByRole('columnheader', { name: 'Ticker' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Price' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Primary entry' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Secondary entry' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Take profit' })).toBeTruthy()
  expect(screen.getByText('NVIDIA Corporation')).toBeTruthy()
  expect(screen.getByText('$120.00')).toBeTruthy()
  expect(screen.getByText('-5.00% from current')).toBeTruthy()
  expect(screen.getByText('+20.00% from current')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Edit setup' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create setup' })).toBeTruthy()
})

test('expands a table row to show setup details', () => {
  render(<MemoryRouter><WatchlistsPage /></MemoryRouter>)

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
