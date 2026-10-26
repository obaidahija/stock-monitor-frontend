import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { redditOperation } from '@/test/reddit-fixtures'
import { useRedditOperationPoll } from './use-operation-poll'

const api = vi.hoisted(() => ({ getRedditOperation: vi.fn() }))

vi.mock('@/api/reddit', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/reddit')>()),
  ...api,
}))

let client: QueryClient

// Production retries a failed query once; the poll must not spend that retry on a 404.
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

function observers(operationId: string) {
  return client.getQueryCache().find({ queryKey: ['reddit', 'operation', operationId] })?.getObserversCount()
}

beforeEach(() => {
  vi.useFakeTimers()
  client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })
})

afterEach(() => {
  client.clear()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('a deferred operation keeps polling until it succeeds, then reports once', async () => {
  api.getRedditOperation
    .mockResolvedValueOnce(redditOperation('op-1', 'queued'))
    .mockResolvedValueOnce(redditOperation('op-1', 'deferred'))
    .mockResolvedValueOnce(redditOperation('op-1', 'running'))
    .mockResolvedValue(redditOperation('op-1', 'succeeded'))
  const onTerminal = vi.fn()
  const { result } = renderHook(() => useRedditOperationPoll('op-1', onTerminal), { wrapper })

  await vi.waitFor(() => expect(result.current.data?.status).toBe('queued'))
  await advance(2_000)
  await vi.waitFor(() => expect(result.current.data?.status).toBe('deferred'))
  expect(onTerminal).not.toHaveBeenCalled()
  await advance(4_000)
  await vi.waitFor(() => expect(result.current.data?.status).toBe('succeeded'))
  expect(onTerminal).toHaveBeenCalledTimes(1)
  expect(onTerminal).toHaveBeenCalledWith(redditOperation('op-1', 'succeeded'), 'op-1')

  await advance(20_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(4)
  expect(onTerminal).toHaveBeenCalledTimes(1)
})

test('a failed operation stops polling and reports its failure once', async () => {
  const failed = redditOperation('op-1', 'failed', { public_error_message: 'Reddit is rate limiting requests' })
  api.getRedditOperation
    .mockResolvedValueOnce(redditOperation('op-1', 'running'))
    .mockResolvedValue(failed)
  const onTerminal = vi.fn()
  renderHook(() => useRedditOperationPoll('op-1', onTerminal), { wrapper })

  await advance(2_000)
  await vi.waitFor(() => expect(onTerminal).toHaveBeenCalledWith(failed, 'op-1'))
  await advance(20_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(2)
  expect(onTerminal).toHaveBeenCalledTimes(1)
})

test('a permanently missing operation stops polling without retrying', async () => {
  api.getRedditOperation.mockRejectedValue(new ApiError(404, 'operation not found'))
  const onTerminal = vi.fn()
  const { result } = renderHook(() => useRedditOperationPoll('gone', onTerminal), { wrapper })

  await vi.waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError))
  expect(onTerminal).toHaveBeenCalledTimes(1)
  expect(onTerminal).toHaveBeenCalledWith(null, 'gone')

  await advance(30_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(1)
  expect(onTerminal).toHaveBeenCalledTimes(1)
})

test('a transient failure keeps following the operation', async () => {
  api.getRedditOperation
    .mockRejectedValueOnce(new ApiError(502, 'bad gateway'))
    .mockRejectedValueOnce(new ApiError(502, 'bad gateway'))
    .mockResolvedValue(redditOperation('op-1', 'succeeded'))
  const onTerminal = vi.fn()
  renderHook(() => useRedditOperationPoll('op-1', onTerminal), { wrapper })

  await advance(10_000)
  await vi.waitFor(() =>
    expect(onTerminal).toHaveBeenCalledWith(redditOperation('op-1', 'succeeded'), 'op-1'),
  )
})

test('unmounting releases the poll', async () => {
  api.getRedditOperation.mockResolvedValue(redditOperation('op-1', 'running'))
  const onTerminal = vi.fn()
  const { unmount } = renderHook(() => useRedditOperationPoll('op-1', onTerminal), { wrapper })
  await advance(2_000)
  await vi.waitFor(() => expect(api.getRedditOperation).toHaveBeenCalledTimes(2))
  expect(observers('op-1')).toBe(1)

  unmount()
  api.getRedditOperation.mockResolvedValue(redditOperation('op-1', 'succeeded'))
  await advance(20_000)
  expect(api.getRedditOperation).toHaveBeenCalledTimes(2)
  expect(onTerminal).not.toHaveBeenCalled()
  expect(observers('op-1') ?? 0).toBe(0)
})

test('switching operations follows the new one and never reports the old one', async () => {
  api.getRedditOperation.mockImplementation(async (id: string) =>
    id === 'op-1' ? redditOperation('op-1', 'running') : redditOperation('op-2', 'queued'),
  )
  const onTerminal = vi.fn()
  const { rerender } = renderHook(({ id }) => useRedditOperationPoll(id, onTerminal), {
    wrapper,
    initialProps: { id: 'op-1' as string | null },
  })
  await vi.waitFor(() => expect(api.getRedditOperation).toHaveBeenCalledWith('op-1'))
  const oldCalls = () => api.getRedditOperation.mock.calls.filter(([id]) => id === 'op-1').length
  const before = oldCalls()

  rerender({ id: 'op-2' })
  api.getRedditOperation.mockImplementation(async (id: string) => redditOperation(id, 'succeeded'))
  await advance(10_000)

  await vi.waitFor(() =>
    expect(onTerminal).toHaveBeenCalledWith(redditOperation('op-2', 'succeeded'), 'op-2'),
  )
  expect(onTerminal).toHaveBeenCalledTimes(1)
  expect(oldCalls()).toBe(before)
  expect(observers('op-1') ?? 0).toBe(0)
})
