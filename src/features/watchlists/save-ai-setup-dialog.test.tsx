import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { AiResearchOut } from '@/types/api'
import { SaveAiSetupDialog } from './save-ai-setup-dialog'

const mutateAsync = vi.fn()
const capabilities = vi.hoisted(() => ({ swing: false }))

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
  useSetupWindowPreview: (horizonSessions: number, enabled: boolean) => ({
    data: enabled
      ? {
          window: {
            starts_at: '2026-09-21T12:00:00Z',
            anchor_session: '2026-09-21',
            horizon_sessions: horizonSessions,
            expires_at: horizonSessions === 5 ? '2026-09-25T20:00:00Z' : '2026-09-23T20:00:00Z',
            expires_on: horizonSessions === 5 ? '2026-09-25' : '2026-09-23',
            calendar: 'XNYS',
            window_version: 'swing-window-v1',
          },
          server_time: '2026-09-21T12:00:00Z',
        }
      : undefined,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('./hooks', () => {
  const data = [
      {
        id: 1,
        name: 'Watchlist',
        item_count: 2,
        contains_ticker: true,
        membership_id: 8,
        has_setup: true,
      },
      {
        id: 2,
        name: 'Swing',
        item_count: 0,
        contains_ticker: false,
        membership_id: null,
        has_setup: false,
      },
  ]
  return {
    useWatchlists: () => ({ isPending: false, data }),
    useCreateAiSetups: () => ({ mutateAsync, isPending: false }),
  }
})

afterEach(() => {
  cleanup()
  mutateAsync.mockClear()
  capabilities.swing = false
})

const research: AiResearchOut = {
  snapshot_id: 10,
  ticker: 'NVDA',
  score: 70,
  confidence: 65,
  lean: 'bullish',
  summary: 'Constructive.',
  key_drivers: [],
  risks: [],
  price_reference: {
    entry_primary: 100,
    entry_secondary: 95,
    stop_loss: 90,
    take_profit: 120,
    note: 'Support.',
  },
  inputs_used: {
    news_item_ids: [],
    news_item_count: 0,
    twitter_post_ids: [],
    twitter_post_count: 0,
    twitter_cache_is_fresh: false,
    twitter_cache_age_seconds: null,
    reddit_post_ids: [],
    reddit_post_count: 0,
    reddit_cache_is_fresh: false,
    reddit_cache_age_seconds: null,
    quant_facts: [],
  },
  caveat: 'Informational only.',
  source: { ok: true, error: null },
  generated_at: '2026-08-17T12:00:00Z',
  cached: false,
  current_price: 101,
}

test('shows existing memberships without treating unchecked lists as removals', async () => {
  const user = userEvent.setup()
  render(<SaveAiSetupDialog data={research} />)

  await user.click(screen.getByRole('button', { name: /save ai setup/i }))
  const watchlist = screen.getByRole('checkbox', { name: /watchlist/i }) as HTMLInputElement
  const swing = screen.getByRole('checkbox', { name: /swing/i }) as HTMLInputElement
  expect(watchlist.checked).toBe(true)
  expect(swing.checked).toBe(false)
  expect(screen.getByText('Will replace setup')).toBeTruthy()
  expect(screen.getByText('Adds ticker')).toBeTruthy()
})

test('infers the AI side and replaces without asking for side or confirmation', async () => {
  const user = userEvent.setup()
  render(<SaveAiSetupDialog data={research} />)
  await user.click(screen.getByRole('button', { name: /save ai setup/i }))
  expect(screen.getByText('long')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /^save setup$/i }))
  expect(window.confirm).not.toHaveBeenCalled()
  expect(mutateAsync).toHaveBeenCalledWith({
    ticker: 'NVDA',
    snapshot_id: 10,
    watchlist_ids: [1],
    horizon: 'short_term',
    expires_on: undefined,
  })
})

test('disables saving when AI levels are incomplete', async () => {
  const user = userEvent.setup()
  render(
    <SaveAiSetupDialog
      data={{ ...research, price_reference: { ...research.price_reference!, stop_loss: null } }}
    />,
  )
  await user.click(screen.getByRole('button', { name: /save ai setup/i }))
  expect(screen.getByText(/do not form a valid long or short setup/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: /^save setup$/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('hides the swing window while the capability is off', async () => {
  const user = userEvent.setup()
  render(<SaveAiSetupDialog data={research} />)
  await user.click(screen.getByRole('button', { name: /save ai setup/i }))
  expect(screen.queryByRole('option', { name: /swing/i })).toBeNull()
  expect(screen.queryByLabelText('Research window')).toBeNull()
})

test('saves a swing window with a default of five sessions and the server expiry', async () => {
  capabilities.swing = true
  const user = userEvent.setup()
  render(<SaveAiSetupDialog data={research} />)
  await user.click(screen.getByRole('button', { name: /save ai setup/i }))
  await user.selectOptions(screen.getByLabelText('Horizon'), 'swing')

  expect((screen.getByLabelText('Research window') as HTMLSelectElement).value).toBe('5')
  expect(screen.getByText('Expires Fri, Sep 25, 4:00 PM ET')).toBeTruthy()

  await user.selectOptions(screen.getByLabelText('Research window'), '3')
  expect(screen.getByText('Expires Wed, Sep 23, 4:00 PM ET')).toBeTruthy()
  // Choosing a window is not a save.
  expect(mutateAsync).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: /^save setup$/i }))
  expect(mutateAsync).toHaveBeenCalledWith({
    ticker: 'NVDA',
    snapshot_id: 10,
    watchlist_ids: [1],
    horizon: 'swing',
    horizon_sessions: 3,
    expires_on: undefined,
  })
})
