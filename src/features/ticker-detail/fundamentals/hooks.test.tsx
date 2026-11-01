import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FinancialRefresh, FinancialRefreshResult } from '@/types/sec-fundamentals'
import { useFinancialRefresh } from './hooks'

const historyKey = ['sec-fundamentals', 'NVDA', 'quarterly', 24]
let fetchMock: ReturnType<typeof vi.fn>

function request(request_id: string, state: FinancialRefresh['state'], requested_at?: string): FinancialRefreshResult {
  return { ticker: 'NVDA', cik: '0000000123', request_id, state, error: null, snapshot_id: null, ...(requested_at ? { requested_at } : {}) }
}

function setup(saved?: FinancialRefresh) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(historyKey, { snapshot_id: 7 })
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  const hook = renderHook(({ saved }) => useFinancialRefresh('NVDA', saved), {
    initialProps: { saved }, wrapper: Wrapper,
  })
  return { ...hook, queryClient }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test.each(['queued', 'completed'] as const)('follows a newer stored request after a %s manual response settles', async (manualState) => {
  let completeBackground: (response: Response) => void = () => {}
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json(request('manual', manualState))
    if (url.endsWith('/refresh/manual')) return Response.json(request('manual', 'completed'))
    if (url.endsWith('/refresh/background')) return new Promise<Response>((resolve) => { completeBackground = resolve })
    throw new Error(`Unexpected request: ${url}`)
  })
  const hook = setup({ request_id: null, state: 'idle', error: null, snapshot_id: 7 })
  act(() => hook.result.current.refresh.mutate())
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  hook.queryClient.setQueryData(historyKey, { snapshot_id: 7 })

  hook.rerender({ saved: request('background', 'running') })
  await waitFor(() => expect(hook.result.current.result?.request_id).toBe('background'))
  expect(hook.result.current.isRefreshing).toBe(true)
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/refresh/background'))).toBe(true))
  act(() => completeBackground(Response.json(request('background', 'completed'))))
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  expect(hook.result.current.isRefreshing).toBe(false)
  await waitFor(() => expect(hook.queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true))
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('an older stored request cannot replace the newest completed manual request', async () => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json(request('manual', 'queued'))
    if (url.endsWith('/refresh/manual')) return Response.json(request('manual', 'completed'))
    if (url.endsWith('/refresh/older')) return Response.json(request('older', 'completed'))
    throw new Error(`Unexpected request: ${url}`)
  })
  const hook = setup(request('older', 'running'))
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  act(() => hook.result.current.refresh.mutate())
  await waitFor(() => expect(hook.result.current.result?.request_id).toBe('manual'))
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))

  hook.rerender({ saved: request('older', 'running') })
  expect(hook.result.current.result?.request_id).toBe('manual')
  expect(hook.result.current.isRefreshing).toBe(false)
})

test('keeps an accepted background refresh when another period supplies stale or no history', async () => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json(request('manual', 'completed'))
    if (url.endsWith('/refresh/background')) return Response.json(request('background', 'running'))
    throw new Error(`Unexpected request: ${url}`)
  })
  const hook = setup(request('older', 'completed'))
  act(() => hook.result.current.refresh.mutate())
  await waitFor(() => expect(hook.result.current.result?.request_id).toBe('manual'))
  hook.rerender({ saved: request('background', 'running') })
  await waitFor(() => expect(hook.result.current.status.data?.request_id).toBe('background'))

  hook.rerender({ saved: request('older', 'completed') })
  expect(hook.result.current.result?.request_id).toBe('background')
  expect(hook.result.current.isRefreshing).toBe(true)
  hook.rerender({ saved: undefined })
  expect(hook.result.current.result?.request_id).toBe('background')
  expect(hook.result.current.isRefreshing).toBe(true)
})

test('terminal history wins over an older running status for the same request', async () => {
  fetchMock.mockResolvedValue(Response.json(request('background', 'running')))
  const hook = setup(request('background', 'running'))
  await waitFor(() => expect(hook.result.current.status.data?.state).toBe('running'))

  hook.rerender({ saved: request('background', 'completed') })
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  expect(hook.result.current.isRefreshing).toBe(false)
})

test.each(['running', 'completed'] as const)('an unseen stale period request cannot replace a %s newer request', async (state) => {
  fetchMock.mockImplementation(async () => Response.json(request('current', state, '2026-11-02T12:00:00Z')))
  const hook = setup(request('previous-quarterly', 'completed', '2026-11-02T10:00:00Z'))
  hook.queryClient.setQueryData(['sec-fundamentals', 'NVDA', 'annual', 24], {
    refresh: request('stale-annual', 'completed', '2026-11-02T11:00:00Z'),
  })
  hook.rerender({ saved: request('current', state, '2026-11-02T12:00:00Z') })
  await waitFor(() => expect(hook.result.current.result?.request_id).toBe('current'))
  hook.rerender({ saved: request('stale-annual', 'completed', '2026-11-02T11:00:00Z') })
  expect(hook.result.current.result?.request_id).toBe('current')
  expect(hook.result.current.isRefreshing).toBe(state === 'running')
  hook.rerender({ saved: request('current', 'completed', '2026-11-02T12:00:00Z') })
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  expect(hook.result.current.result?.request_id).toBe('current')
})

test('timestamp-free legacy history cannot replace a newer timestamped refresh', async () => {
  const hook = setup(request('current', 'completed', '2026-11-02T12:00:00Z'))
  hook.rerender({ saved: request('stale-annual', 'completed') })
  expect(hook.result.current.result?.request_id).toBe('current')
})

test('a genuinely newer stored request is followed after background work completes', async () => {
  fetchMock.mockResolvedValue(Response.json(request('newer', 'completed', '2026-11-02T13:00:00Z')))
  const hook = setup(request('current', 'completed', '2026-11-02T12:00:00Z'))
  hook.rerender({ saved: request('newer', 'running', '2026-11-02T13:00:00Z') })
  await waitFor(() => expect(hook.result.current.result?.request_id).toBe('newer'))
  await waitFor(() => expect(hook.result.current.result?.state).toBe('completed'))
  expect(hook.result.current.isRefreshing).toBe(false)
  await waitFor(() => expect(hook.queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true))
  hook.rerender({ saved: request('unseen-older', 'running', '2026-11-02T11:30:00Z') })
  expect(hook.result.current.result?.request_id).toBe('newer')
})
