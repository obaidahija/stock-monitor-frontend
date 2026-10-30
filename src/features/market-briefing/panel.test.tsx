import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { MarketBriefingOut } from '@/types/api'
import { MarketBriefingPanel } from './panel'
import * as hooks from './hooks'

vi.mock('./hooks', () => ({ useMarketBriefing: vi.fn(), useRefreshMarketBriefing: vi.fn() }))
const mutate = vi.fn()
const refetch = vi.fn()
const snapshot: MarketBriefingOut = {
  stories: [{
    headline: 'Chip demand weakens', summary: 'Intel reported PC market pressure.',
    significance: 'Hardware demand remains uncertain.', reported_date: '2026-10-30',
    reported_reaction: 'Chip stocks faced selling pressure.',
    industry_impacts: [
      { industry: 'Semiconductors', direction: 'negative', rationale: 'Lower PC orders may reduce chip demand.' },
      { industry: 'Utilities - Regulated Electric', direction: 'positive', rationale: 'Investors may rotate toward defensive companies.' },
    ], source_ids: [1], evidence_quote: 'Intel reported PC market pressure.',
  }],
  sources: [{ id: 1, title: 'Market report', publisher: 'Reuters', url: 'https://reuters.com/news' }],
  run_date: '2026-10-30', generated_at: '2026-10-30T16:20:00Z', refresh_active: false,
  active_run_id: null, stale: false, stale_reason: null, source_error: null, enabled: true,
  disclaimer: 'Industry effects are AI assessments.',
}

function setQuery(data: MarketBriefingOut | undefined, extra = {}) {
  vi.mocked(hooks.useMarketBriefing).mockReturnValue({
    data, isPending: false, isError: false, error: null, refetch, ...extra,
  } as unknown as ReturnType<typeof hooks.useMarketBriefing>)
}

beforeEach(() => {
  vi.clearAllMocks()
  setQuery(snapshot)
  vi.mocked(hooks.useRefreshMarketBriefing).mockReturnValue({
    mutate, isPending: false, isError: false, error: null,
  } as unknown as ReturnType<typeof hooks.useRefreshMarketBriefing>)
})
afterEach(cleanup)

const storyButton = () => screen.getByRole('button', { name: 'Read briefing: Chip demand weakens' })

test('compact list shows headlines and both impact counts without the full article', () => {
  renderWithProviders(<MarketBriefingPanel />)
  expect(storyButton()).toHaveTextContent('1 negative')
  expect(storyButton()).toHaveTextContent('1 positive')
  expect(screen.queryByText(snapshot.stories[0].summary)).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(mutate).not.toHaveBeenCalled()
})

test('click opens full summary, industry rationales, reaction and sources, then closes', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketBriefingPanel />)
  await user.click(storyButton())
  const preview = await screen.findByRole('dialog', { name: 'Chip demand weakens' })
  expect(within(preview).getByText(snapshot.stories[0].summary)).toBeInTheDocument()
  expect(within(preview).getByText('Semiconductors · negative')).toBeInTheDocument()
  expect(within(preview).getByText('Lower PC orders may reduce chip demand.')).toBeInTheDocument()
  expect(within(preview).getByText(/Reported reaction:/)).toBeInTheDocument()
  expect(within(preview).getByRole('link', { name: 'Reuters' })).toHaveAttribute('href', 'https://reuters.com/news')
  await user.click(screen.getByRole('button', { name: 'Close briefing preview' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(storyButton()).toHaveFocus()
})

test('mouse hover opens a preview without stealing focus and leaving closes it', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketBriefingPanel />)
  const focus = screen.getByRole('button', { name: 'Refresh briefing' })
  focus.focus()
  await user.hover(storyButton())
  await screen.findByRole('dialog')
  expect(focus).toHaveFocus()
  await user.unhover(storyButton())
  await user.hover(screen.getByRole('dialog'))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.unhover(screen.getByRole('dialog'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('keyboard opens and Escape dismisses with focus restored', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketBriefingPanel />)
  storyButton().focus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(storyButton()).toHaveFocus()
})

test('tap/click pins the preview after the pointer leaves', async () => {
  const user = userEvent.setup()
  renderWithProviders(<MarketBriefingPanel />)
  await user.click(storyButton())
  await user.unhover(storyButton())
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)) })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('refresh is explicitly requested', async () => {
  renderWithProviders(<MarketBriefingPanel />)
  await userEvent.click(screen.getByRole('button', { name: 'Refresh briefing' }))
  expect(mutate).toHaveBeenCalledOnce()
})

test('first use has an empty state', () => {
  setQuery({ ...snapshot, stories: [], sources: [], generated_at: null, run_date: null })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByText(/No briefing yet/)).toBeInTheDocument()
})

test('loading is visible', () => {
  setQuery(undefined, { isPending: true })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByRole('status', { name: 'Loading briefing' })).toBeInTheDocument()
})

test('active refresh keeps previous news and disables duplicate refresh', () => {
  setQuery({ ...snapshot, refresh_active: true })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByRole('button', { name: 'Refresh briefing' })).toBeDisabled()
  expect(storyButton()).toBeInTheDocument()
  expect(screen.getByText(/Generating briefing/)).toBeInTheDocument()
})

test('failed refresh preserves the old result with a stale notice', () => {
  setQuery({ ...snapshot, stale: true, stale_reason: 'refresh_failed', source_error: 'Google Finance unavailable.' })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByText('Stale')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Showing the previous briefing.')
  expect(storyButton()).toBeInTheDocument()
})

test('previous-day briefing invites a refresh', () => {
  setQuery({ ...snapshot, stale: true, stale_reason: 'previous_day' })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByText(/Previous US Eastern news day/)).toBeInTheDocument()
})

test('disabled integration links to Settings', () => {
  setQuery({ ...snapshot, enabled: false })
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByRole('button', { name: 'Refresh briefing' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
})

test('read errors provide a retry and refresh errors remain visible', async () => {
  setQuery(undefined, { isError: true, error: new Error('Read failed') })
  vi.mocked(hooks.useRefreshMarketBriefing).mockReturnValue({
    mutate, isPending: false, isError: true, error: new Error('Refresh failed'),
  } as unknown as ReturnType<typeof hooks.useRefreshMarketBriefing>)
  renderWithProviders(<MarketBriefingPanel />)
  expect(screen.getByText('Briefing is temporarily unavailable.')).toBeInTheDocument()
  expect(screen.getByText('Refresh failed. Try again.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry briefing' }))
  expect(refetch).toHaveBeenCalledOnce()
})

test('no industry mapping or unsafe source links are shown as invented details', async () => {
  setQuery({ ...snapshot,
    stories: [{ ...snapshot.stories[0], industry_impacts: [], reported_reaction: null }],
    sources: [{ ...snapshot.sources[0], url: 'javascript:alert(1)' }],
  })
  renderWithProviders(<MarketBriefingPanel />)
  await userEvent.click(storyButton())
  expect(screen.getByText('No supported mapping to tracked industries.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Reuters' })).not.toBeInTheDocument()
})
