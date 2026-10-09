import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { WatchlistSetupOut } from '@/types/api'
import { SetupHistoryDialog } from './setup-history-dialog'

const clone = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }))
const history = vi.hoisted(() => ({ rows: [] as unknown[] }))
const capabilities = vi.hoisted(() => ({ swing: true }))

vi.mock('./hooks', () => ({
  useSetupHistory: () => ({ data: history.rows, isPending: false }),
  useCloneSetup: () => clone,
}))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: {
      swing_research_enabled: capabilities.swing,
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
}))

afterEach(() => {
  cleanup()
  clone.mutateAsync.mockReset()
  capabilities.swing = true
})

const expiredSwing: WatchlistSetupOut = {
  id: 30,
  watchlist_item_id: 10,
  ticker: 'NVDA',
  side: 'short',
  horizon: 'swing',
  horizon_sessions: 3,
  window: {
    starts_at: '2026-11-24T15:00:00Z',
    anchor_session: '2026-11-24',
    horizon_sessions: 3,
    expires_at: '2026-11-27T18:00:00Z',
    expires_on: '2026-11-27',
    calendar: 'XNYS',
    window_version: 'swing-window-v1',
  },
  expires_on: '2026-11-27',
  source_mode: 'manual',
  status: 'expired',
  is_current: true,
  entry_primary: 100,
  entry_secondary: null,
  stop_loss: 110,
  take_profit: 90,
  note: null,
  research_snapshot_id: null,
  levels_snapshot_id: null,
  needs_review: false,
  sync_error: null,
  research: null,
  created_at: '2026-11-24T15:00:00Z',
  updated_at: '2026-11-24T15:00:00Z',
  superseded_at: null,
}

test('shows an expired swing window with its exact early-close expiry', async () => {
  history.rows = [expiredSwing]
  const user = userEvent.setup()
  render(<SetupHistoryDialog itemId={10} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /history/i }))

  expect(screen.getByText(/short · expired/i)).toBeTruthy()
  expect(screen.getByText('Swing · 3 trading sessions')).toBeTruthy()
  expect(screen.getByText('Expires Fri, Nov 27, 1:00 PM ET')).toBeTruthy()
})

test('restores a swing setup as a fresh window of the same length', async () => {
  history.rows = [expiredSwing]
  const user = userEvent.setup()
  render(<SetupHistoryDialog itemId={10} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /history/i }))
  await user.click(screen.getByRole('button', { name: /restore/i }))

  expect(window.confirm).toHaveBeenCalledWith(
    'Restore this as a new current setup with a fresh 3-session swing window?',
  )
  expect(clone.mutateAsync).toHaveBeenCalledWith({
    id: 30,
    body: { side: 'short', horizon: 'swing', horizon_sessions: 3, replace_existing: true },
  })
})

test('restores with the legacy 20-day horizon while swing research is off', async () => {
  capabilities.swing = false
  history.rows = [expiredSwing]
  const user = userEvent.setup()
  render(<SetupHistoryDialog itemId={10} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /history/i }))
  // Stored research history stays visible while the feature is off.
  expect(screen.getByText('Swing · 3 trading sessions')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /restore/i }))

  expect(clone.mutateAsync).toHaveBeenCalledWith({
    id: 30,
    body: { side: 'short', horizon: 'short_term', replace_existing: true },
  })
})

test('a setup saved from a scanner match shows where it came from', async () => {
  history.rows = [
    {
      ...expiredSwing,
      side: 'long',
      stop_loss: 90,
      take_profit: 110,
      strategy_observation_id: 7,
      strategy_provenance: {
        observation_id: 7,
        source_kind: 'short_squeeze',
        rule_version: 'short-squeeze-daily-v1',
        signal_session: '2026-10-05',
      },
    },
  ]
  const user = userEvent.setup()
  render(<SetupHistoryDialog itemId={10} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /history/i }))

  expect(screen.getByText(/From a Short Squeeze match · signal session Oct 5, 2026/)).toBeTruthy()
})

test('an ordinary setup shows no scanner origin', async () => {
  history.rows = [expiredSwing]
  const user = userEvent.setup()
  render(<SetupHistoryDialog itemId={10} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /history/i }))

  expect(screen.queryByText(/Short Squeeze/)).toBeNull()
})
