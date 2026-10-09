import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { currentLocation } from '@/test/location'
import { LocationProbe } from '@/test/location-probe'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from './routes'

// Each Social view is a whole page with its own data. These tests are about
// which view a URL shows, so each page is replaced by a labelled marker.
vi.mock('@/pages/trending-page', () => ({ TrendingPage: () => <p>Trending view</p> }))
vi.mock('@/pages/twitter-page', () => ({ TwitterPage: () => <p>Twitter view</p> }))
vi.mock('@/pages/reddit-page', () => ({ RedditPage: () => <p>Reddit view</p> }))
vi.mock('@/pages/research-page', () => ({ ResearchPage: () => <p>Research view</p> }))

const twitterApi = vi.hoisted(() => ({ getTwitterAuth: vi.fn() }))
const redditApi = vi.hoisted(() => ({ getRedditAuth: vi.fn() }))

vi.mock('@/api/twitter', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/twitter')>()),
  ...twitterApi,
}))
vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...redditApi,
}))

function renderApp(path: string) {
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    [path],
  )
}

function socialViewLink(name: string) {
  return within(screen.getByRole('navigation', { name: 'Social views' })).getByRole('link', { name })
}

afterEach(cleanup)

beforeEach(() => {
  // Different states per platform, so each login status label is unambiguous on screen.
  twitterApi.getTwitterAuth.mockResolvedValue({
    state: 'rate_limited',
    checked_at: null,
    public_message: null,
    cooldown_until: null,
  })
  redditApi.getRedditAuth.mockResolvedValue({
    state: 'unavailable',
    checked_at: null,
    username: null,
    public_message: 'reddit_intelligence_disabled',
    cooldown_until: null,
    public_reads_available: false,
  })
})

test('main navigation marks Social as current on every Social view', async () => {
  renderApp('/social/reddit')
  expect(await screen.findByText('Reddit view')).toBeInTheDocument()

  const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
  const social = within(mainNav).getByRole('link', { name: 'Social' })
  expect(social).toHaveAttribute('href', '/social')
  expect(social).toHaveAttribute('aria-current', 'page')
})

test('main navigation opens the Research page', async () => {
  const user = userEvent.setup()
  renderApp('/social/trending')
  expect(await screen.findByText('Trending view')).toBeInTheDocument()
  const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })

  await user.click(within(mainNav).getByRole('link', { name: 'Research' }))

  expect(await screen.findByText('Research view')).toBeInTheDocument()
  expect(currentLocation()).toBe('/research')
  expect(within(mainNav).getByRole('link', { name: 'Research' })).toHaveAttribute('aria-current', 'page')
})

test('/social opens the Trending view', async () => {
  renderApp('/social')
  expect(await screen.findByText('Trending view')).toBeInTheDocument()
  expect(currentLocation()).toBe('/social/trending')
  expect(socialViewLink('Trending')).toHaveAttribute('aria-current', 'page')
})

test('the Twitter view shows the Twitter login status', async () => {
  renderApp('/social/twitter')
  expect(await screen.findByText('Rate limited')).toBeInTheDocument()
  expect(screen.getByText('Twitter view')).toBeInTheDocument()
  expect(screen.queryByText('Reddit view')).not.toBeInTheDocument()
})

test('the Reddit view shows the Reddit login status', async () => {
  renderApp('/social/reddit')
  expect(await screen.findByText('Disabled')).toBeInTheDocument()
  expect(screen.getByText('Reddit view')).toBeInTheDocument()
  expect(screen.queryByText('Rate limited')).not.toBeInTheDocument()
})

test('the switch moves between views and Trending shows no login status', async () => {
  const user = userEvent.setup()
  renderApp('/social/twitter')
  expect(await screen.findByText('Rate limited')).toBeInTheDocument()

  await user.click(socialViewLink('Reddit'))
  expect(await screen.findByText('Reddit view')).toBeInTheDocument()
  expect(await screen.findByText('Disabled')).toBeInTheDocument()
  expect(currentLocation()).toBe('/social/reddit')

  await user.click(socialViewLink('Trending'))
  expect(await screen.findByText('Trending view')).toBeInTheDocument()
  // Both statuses are cached by now, so a mounted status badge would show its label immediately.
  expect(screen.queryByText('Rate limited')).not.toBeInTheDocument()
  expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
})

test('an unknown Social view falls back to Trending', async () => {
  renderApp('/social/nonsense')
  expect(await screen.findByText('Trending view')).toBeInTheDocument()
  expect(currentLocation()).toBe('/social/trending')
})

test.each([
  ['/twitter?sort=newest&tickers=NVDA', '/social/twitter?sort=newest&tickers=NVDA', 'Twitter view'],
  ['/reddit?post_types=news', '/social/reddit?post_types=news', 'Reddit view'],
  ['/trending?tab=general', '/social/trending?tab=general', 'Trending view'],
])('old link %s redirects to %s and keeps its filters', async (oldPath, newPath, view) => {
  renderApp(oldPath)
  expect(await screen.findByText(view)).toBeInTheDocument()
  expect(currentLocation()).toBe(newPath)
})
