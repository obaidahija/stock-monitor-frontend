import { cleanup, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { RedditAuthStatusBanner } from './auth-status-banner'

const api = vi.hoisted(() => ({
  getRedditAuth: vi.fn(),
}))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

beforeEach(() => {
  cleanup()
  api.getRedditAuth.mockReset()
})

test('explains that cached discussions remain available during authentication recovery', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'checking',
    checked_at: null,
    username: null,
    public_message: 'Recovering Reddit authentication...',
    cooldown_until: null,
    public_reads_available: false,
  })

  renderWithProviders(<RedditAuthStatusBanner />)

  expect(await screen.findByText('Recovering Reddit authentication…')).toBeInTheDocument()
  expect(screen.getByText('Cached discussions remain available.')).toBeInTheDocument()
})

test('shows when automatic authentication recovery may resume after failure', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'invalid',
    checked_at: '2026-08-17T12:00:00Z',
    username: null,
    public_message: 'Reddit automatic authentication recovery failed.',
    cooldown_until: '2026-08-17T12:30:00Z',
    public_reads_available: false,
  })

  renderWithProviders(<RedditAuthStatusBanner />)

  expect(
    await screen.findByText(/Automatic recovery paused until Aug 17/),
  ).toBeInTheDocument()
  expect(screen.getByText('Cached discussions remain available.')).toBeInTheDocument()
})

test('does not show recovery messaging for a valid authentication state', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'valid',
    checked_at: '2026-08-17T12:00:00Z',
    username: 'market_user',
    public_message: 'Connected',
    cooldown_until: null,
    public_reads_available: true,
  })

  renderWithProviders(<RedditAuthStatusBanner />)

  expect(await screen.findByText('Reddit: valid')).toBeInTheDocument()
  expect(screen.queryByText(/Recovering Reddit authentication/)).not.toBeInTheDocument()
  expect(screen.queryByText('Cached discussions remain available.')).not.toBeInTheDocument()
})
