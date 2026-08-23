import { cleanup, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { RedditAuthStatusIndicator } from './auth-status-banner'

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

test('shows Connected for a valid authentication state', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'valid',
    checked_at: '2026-08-17T12:00:00Z',
    username: 'market_user',
    public_message: 'Connected',
    cooldown_until: null,
    public_reads_available: true,
  })

  renderWithProviders(<RedditAuthStatusIndicator />)

  expect(await screen.findByText('Connected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recheck Reddit auth' })).toBeEnabled()
})

test('shows Recovering while auto-reauth is in progress', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'checking',
    checked_at: null,
    username: null,
    public_message: 'Recovering Reddit authentication...',
    cooldown_until: null,
    public_reads_available: false,
  })

  renderWithProviders(<RedditAuthStatusIndicator />)

  expect(await screen.findByText('Recovering…')).toBeInTheDocument()
})

test('shows Disabled and disables the recheck action while the feature flag is off', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'unavailable',
    checked_at: null,
    username: null,
    public_message: 'reddit_intelligence_disabled',
    cooldown_until: null,
    public_reads_available: false,
  })

  renderWithProviders(<RedditAuthStatusIndicator />)

  expect(await screen.findByText('Disabled')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recheck Reddit auth' })).toBeDisabled()
})

test('shows Invalid credentials and disables recheck during cooldown', async () => {
  api.getRedditAuth.mockResolvedValue({
    state: 'invalid',
    checked_at: '2026-08-17T12:00:00Z',
    username: null,
    public_message: 'Reddit automatic authentication recovery failed.',
    cooldown_until: '2999-01-01T00:00:00Z',
    public_reads_available: false,
  })

  renderWithProviders(<RedditAuthStatusIndicator />)

  expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recheck Reddit auth' })).toBeDisabled()
})
