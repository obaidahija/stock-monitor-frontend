import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { WatchlistEventOut, WatchlistItemOut } from '@/types/api'
import { WatchlistEventsDialog } from './watchlist-events-dialog'

const create = vi.fn()
const update = vi.fn()
const rearm = vi.fn()
const remove = vi.fn()
const retry = vi.fn()
const sendTest = vi.fn()
let telegramReady = true
let eventsData: WatchlistEventOut[] = []

vi.mock('./hooks', () => ({
  useWatchlistEvents: () => ({ data: eventsData, isPending: false }),
  useTelegramStatus: () => ({
    data: telegramReady
      ? { configured: true, ready: true, error: null }
      : { configured: false, ready: false, error: 'Telegram is not configured' },
    isPending: false,
  }),
  useCreateWatchlistEvent: () => ({ mutateAsync: create, isPending: false }),
  useUpdateWatchlistEvent: () => ({ mutateAsync: update, isPending: false }),
  useRearmWatchlistEvent: () => ({ mutateAsync: rearm, isPending: false }),
  useDeleteWatchlistEvent: () => ({ mutateAsync: remove, isPending: false }),
  useRetryWatchlistEventDelivery: () => ({ mutateAsync: retry, isPending: false }),
  useSendTelegramTest: () => ({ mutateAsync: sendTest, isPending: false }),
}))

const item: WatchlistItemOut = {
  id: 10,
  watchlist_id: 1,
  ticker: 'NVDA',
  company_name: 'NVIDIA',
  created_at: '2026-08-01T12:00:00Z',
  current_price: 225.01,
  session_price: 225.13,
  quote_updated_at: '2026-08-17T23:59:59Z',
  market_session: 'post_market',
  distance_pct: null,
  event_count: 0,
  active_event_count: 0,
  has_event_delivery_failure: false,
  current_setup: {
    id: 20,
    watchlist_item_id: 10,
    ticker: 'NVDA',
    side: 'long',
    horizon: 'short_term',
    expires_on: '2026-09-01',
    source_mode: 'manual',
    status: 'active',
    is_current: true,
    entry_primary: 218,
    entry_secondary: 212,
    stop_loss: 205,
    take_profit: 245,
    note: null,
    research_snapshot_id: null,
    levels_snapshot_id: null,
    needs_review: false,
    sync_error: null,
    research: null,
    created_at: '2026-08-01T12:00:00Z',
    updated_at: '2026-08-01T12:00:00Z',
    superseded_at: null,
  },
}

beforeEach(() => {
  telegramReady = true
  eventsData = []
  vi.clearAllMocks()
})

afterEach(cleanup)

test('creates a setup-linked take-profit event', async () => {
  const user = userEvent.setup()
  render(<WatchlistEventsDialog item={item} />)

  await user.click(screen.getByRole('button', { name: /manage nvda price events/i }))
  await user.click(screen.getByRole('button', { name: /take profit/i }))

  expect((screen.getByLabelText('Condition') as HTMLSelectElement).value).toBe('gte')
  expect((screen.getByLabelText('Target price') as HTMLInputElement).value).toBe('245')
  await user.type(screen.getByLabelText('Message'), 'Take profits now')
  await user.click(screen.getByRole('button', { name: 'Save event' }))

  expect(create).toHaveBeenCalledWith({
    itemId: 10,
    body: {
      event_type: 'price_threshold',
      condition: { kind: 'setup_level', setup_id: 20, level: 'take_profit' },
      message: 'Take profits now',
    },
  })
})

test('warns for an already-satisfied custom condition', async () => {
  const user = userEvent.setup()
  render(<WatchlistEventsDialog item={item} />)
  await user.click(screen.getByRole('button', { name: /manage nvda price events/i }))
  await user.type(screen.getByLabelText('Target price'), '230')

  expect(screen.getByText(/condition is already true/i)).toBeTruthy()
})

test('blocks saving when Telegram is not configured', async () => {
  telegramReady = false
  const user = userEvent.setup()
  render(<WatchlistEventsDialog item={item} />)
  await user.click(screen.getByRole('button', { name: /manage nvda price events/i }))
  await user.type(screen.getByLabelText('Target price'), '200')

  expect(screen.getByText(/set telegram_bot_token/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Save event' }) as HTMLButtonElement).disabled).toBe(true)
})

test('shows a failed latest delivery and retries it', async () => {
  eventsData = [
    {
      id: 30,
      watchlist_item_id: 10,
      ticker: 'NVDA',
      event_type: 'price_threshold',
      state: 'triggered',
      condition: {
        kind: 'custom',
        comparison: 'gte',
        threshold_price: 245,
        setup_id: null,
        level: null,
      },
      message: 'Target hit',
      activation_version: 1,
      triggered_at: '2026-08-17T20:00:00Z',
      disabled_at: null,
      disabled_reason: null,
      created_at: '2026-08-17T19:00:00Z',
      updated_at: '2026-08-17T20:00:00Z',
      last_occurrence: {
        id: 40,
        observed_price: 245.1,
        market_session: 'regular',
        quote_at: '2026-08-17T20:00:00Z',
        triggered_at: '2026-08-17T20:00:00Z',
        delivery_status: 'failed',
        delivery_attempts: 5,
        last_error: 'Forbidden',
        sent_at: null,
      },
    },
  ]
  const user = userEvent.setup()
  render(<WatchlistEventsDialog item={item} />)
  await user.click(screen.getByRole('button', { name: /manage nvda price events/i }))
  await user.click(screen.getByRole('button', { name: /retry delivery/i }))

  expect(retry).toHaveBeenCalledWith(30)
})
