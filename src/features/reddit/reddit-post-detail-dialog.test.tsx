import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  redditComment,
  redditOperation,
  redditPost,
  redditThread,
} from '@/test/reddit-fixtures'
import type { RedditPostOut } from '@/types/api'
import { RedditPostDetailDialog } from './reddit-post-detail-dialog'

const api = vi.hoisted(() => ({
  getRedditPost: vi.fn(),
  refreshRedditThread: vi.fn(),
  getRedditOperation: vi.fn(),
}))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

const postA = redditPost('p1', 'Thread A')
const postB = redditPost('p2', 'Thread B')

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

function dialog(post: RedditPostOut | null) {
  return <RedditPostDetailDialog post={post} onOpenChange={() => {}} />
}

function callsFor(mock: typeof api.getRedditPost, id: string) {
  return mock.mock.calls.filter(([value]) => value === id).length
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('a queued discussion refresh shows progress, then the refreshed comments', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  let refreshed = false
  api.getRedditPost.mockImplementation(async () =>
    refreshed
      ? redditThread(postA, [redditComment('c2', 'Fresh reply')])
      : redditThread(postA, [redditComment('c1', 'Cached reply')]),
  )
  api.refreshRedditThread.mockResolvedValue(
    redditThread(postA, [redditComment('c1', 'Cached reply')], redditOperation('op-1', 'queued')),
  )
  api.getRedditOperation
    .mockResolvedValueOnce(redditOperation('op-1', 'running'))
    .mockImplementation(async () => {
      refreshed = true
      return redditOperation('op-1', 'succeeded')
    })
  renderWithProviders(dialog(postA))
  expect(await screen.findByText('Cached reply')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Refresh discussion' }))

  expect(await screen.findByText(/Refreshing discussion/)).toHaveAttribute('role', 'status')
  expect(screen.getByText('Cached reply')).toBeInTheDocument()
  await advance(2_000)

  expect(await screen.findByText('Fresh reply')).toBeInTheDocument()
  expect(screen.queryByText(/Refreshing discussion/)).not.toBeInTheDocument()
})

test('a failed refresh keeps the cached discussion and offers a deliberate retry', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  api.getRedditPost.mockResolvedValue(redditThread(postA, [redditComment('c1', 'Cached reply')]))
  api.refreshRedditThread.mockResolvedValue(
    redditThread(postA, [redditComment('c1', 'Cached reply')], redditOperation('op-1', 'queued')),
  )
  api.getRedditOperation.mockResolvedValue(
    redditOperation('op-1', 'failed', {
      public_error_code: 'rate_limited',
      public_error_message: 'Reddit is rate limiting requests',
    }),
  )
  renderWithProviders(dialog(postA))
  await screen.findByText('Cached reply')

  await user.click(screen.getByRole('button', { name: 'Refresh discussion' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Reddit is rate limiting requests')
  expect(alert).not.toHaveTextContent('rate_limited')
  expect(screen.getByText('Cached reply')).toBeInTheDocument()
  await advance(10_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(1)

  await user.click(within(alert).getByRole('button', { name: 'Retry refresh' }))
  expect(api.refreshRedditThread).toHaveBeenCalledTimes(2)
})

test('closing the dialog stops following and reopening resumes the same refresh', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  let refreshed = false
  api.getRedditPost.mockImplementation(async () =>
    redditThread(postA, [redditComment(refreshed ? 'c2' : 'c1', refreshed ? 'Fresh reply' : 'Cached reply')]),
  )
  api.refreshRedditThread.mockResolvedValue(
    redditThread(postA, [redditComment('c1', 'Cached reply')], redditOperation('op-1', 'queued')),
  )
  api.getRedditOperation.mockResolvedValue(redditOperation('op-1', 'running'))
  const view = renderWithProviders(dialog(postA))
  await screen.findByText('Cached reply')
  await user.click(screen.getByRole('button', { name: 'Refresh discussion' }))
  await screen.findByText(/Refreshing discussion/)

  view.rerender(dialog(null))
  const followed = api.getRedditOperation.mock.calls.length
  await advance(10_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(followed)

  refreshed = true
  api.getRedditOperation.mockResolvedValue(redditOperation('op-1', 'succeeded'))
  view.rerender(dialog(postA))

  expect(await screen.findByText('Fresh reply')).toBeInTheDocument()
})

test('a late completion never refreshes the discussion opened since', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  api.getRedditPost.mockImplementation(async (id: string) =>
    redditThread(id === 'p1' ? postA : postB, [redditComment(`${id}-c`, `Reply in ${id}`, id)]),
  )
  api.refreshRedditThread.mockResolvedValue(
    redditThread(postA, [redditComment('p1-c', 'Reply in p1')], redditOperation('op-a', 'queued')),
  )
  api.getRedditOperation.mockResolvedValue(redditOperation('op-a', 'running'))
  const view = renderWithProviders(dialog(postA))
  await screen.findByText('Reply in p1')
  await user.click(screen.getByRole('button', { name: 'Refresh discussion' }))
  await screen.findByText(/Refreshing discussion/)

  view.rerender(dialog(postB))
  await screen.findByText('Reply in p2')
  api.getRedditOperation.mockResolvedValue(redditOperation('op-a', 'succeeded'))
  await advance(10_000)

  expect(callsFor(api.getRedditPost, 'p2')).toBe(1)
  expect(screen.queryByText(/Refreshing discussion/)).not.toBeInTheDocument()
})
