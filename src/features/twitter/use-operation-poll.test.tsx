import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getTwitterOperation } from '@/api/twitter'
import { ApiError } from '@/lib/api-client'
import { twitterOperation } from '@/features/ticker-detail/company-x/test-fixtures'
import { useTwitterOperationPoll } from './use-operation-poll'

vi.mock('@/api/twitter', () => ({ getTwitterOperation: vi.fn() }))

let client: QueryClient

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.useFakeTimers()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('an expired operation stops automatic status requests', async () => {
  vi.mocked(getTwitterOperation).mockRejectedValue(new ApiError(404, 'operation not found'))
  const hook = renderHook(() => useTwitterOperationPoll('expired-operation'), { wrapper })
  await vi.waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(getTwitterOperation).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(getTwitterOperation).toHaveBeenCalledTimes(1)
})

test('a temporary status error keeps polling and recovers', async () => {
  vi.mocked(getTwitterOperation)
    .mockRejectedValueOnce(new ApiError(503, 'temporarily unavailable'))
    .mockResolvedValue(twitterOperation('recoverable-operation', 'running', 'stock_search'))
  const hook = renderHook(() => useTwitterOperationPoll('recoverable-operation'), { wrapper })
  await vi.waitFor(() => expect(hook.result.current.isError).toBe(true))
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  await vi.waitFor(() => expect(hook.result.current.data?.status).toBe('running'))
  expect(hook.result.current.isError).toBe(false)
})
