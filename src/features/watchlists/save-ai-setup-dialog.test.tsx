import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { AiResearchOut } from '@/types/api'
import { SaveAiSetupDialog } from './save-ai-setup-dialog'

const mutateAsync = vi.fn()

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

afterEach(cleanup)

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
