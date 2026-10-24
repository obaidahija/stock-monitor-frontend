import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SystemPage } from '@/pages/system-page'

// Other System tabs are outside this flow. Network requests stay mocked at fetch.
vi.mock('@/features/system/health-panel', () => ({ HealthPanel: () => null }))

const savedArchive = {
  generated_at: '2026-10-13T14:00:00Z',
  collections: [
    {
      kind: 'catalyst', label: 'Catalyst research', description: 'Saved catalysts and measured outcomes.',
      retention: 'manual_only',
      counts: [
        { key: 'candidates', label: 'Candidates', count: 20 },
        { key: 'observations', label: 'Observations', count: 30 },
        { key: 'outcomes', label: 'Outcomes', count: 0 },
      ],
      total_records: 50, first_date: '2025-01-02', last_date: '2026-10-12',
    },
    {
      kind: 'pair_strategy', label: 'Pair strategy reports', description: 'Currently saved pair reports.',
      retention: 'latest_only', counts: [{ key: 'reports', label: 'Reports', count: 2 }],
      total_records: 2, first_date: '2026-10-01', last_date: '2026-10-12',
    },
    {
      kind: 'social_curated', label: 'Saved social rankings', description: 'Saved curated rankings.',
      retention: 'manual_only', counts: [{ key: 'rankings', label: 'Rankings', count: 0 }],
      total_records: 0, first_date: null, last_date: null,
    },
  ],
}

function makePreview(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'catalyst', label: 'Catalyst research', date_from: '2026-10-01', date_to: '2026-10-03',
    counts: [
      { key: 'candidates', label: 'Candidates', count: 5 },
      { key: 'observations', label: 'Observations', count: 7 },
      { key: 'outcomes', label: 'Outcomes', count: 0 },
    ],
    total_records: 12, protected_records: 3,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), token: 'reviewed-token',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface RequestRecord {
  path: string
  method: string
  body: unknown
}

let requests: RequestRecord[]
let inventoryResponse: () => Promise<Response>
let previewResponse: () => Promise<Response>
let deleteResponse: () => Promise<Response>
const clients: QueryClient[] = []

beforeEach(() => {
  requests = []
  inventoryResponse = async () => jsonResponse(savedArchive)
  previewResponse = async () => jsonResponse(makePreview())
  deleteResponse = async () => jsonResponse({
    kind: 'catalyst', counts: makePreview().counts, total_records: 12, deleted_at: '2026-10-13T14:01:00Z',
  })
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ path: input, method, body })
    if (input === '/v1/research-archive' && method === 'GET') return inventoryResponse()
    if (input === '/v1/research-archive/preview' && method === 'POST') return previewResponse()
    if (input === '/v1/research-archive/delete' && method === 'POST') return deleteResponse()
    throw new Error(`Unexpected request: ${method} ${input}`)
  }))
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mount(client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  clients.push(client)
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/system?tab=archive']}><SystemPage /></MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

async function chooseCollection(label = 'Catalyst research') {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('combobox', { name: 'Research collection' }))
  await user.click(screen.getByRole('option', { name: label }))
}

async function selectRange() {
  await chooseCollection()
  fireEvent.change(screen.getByLabelText('Saved from (New York)'), { target: { value: '2026-10-01' } })
  fireEvent.change(screen.getByLabelText('Saved through (New York)'), { target: { value: '2026-10-03' } })
}

async function loadPreview() {
  await selectRange()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  return screen.findByRole('region', { name: 'Cleanup preview' })
}

function confirmDelete(value = 'DELETE') {
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value } })
}

function deletionRequests() {
  return requests.filter((request) => request.path === '/v1/research-archive/delete')
}

test('inventories every table count and the currently stored report policy without requesting deletion', async () => {
  mount()
  const collection = await screen.findByRole('region', { name: 'Catalyst research' })
  expect(within(collection).getByRole('row', { name: /Candidates 20/ })).toBeInTheDocument()
  expect(within(collection).getByRole('row', { name: /Observations 30/ })).toBeInTheDocument()
  expect(within(collection).getByRole('row', { name: /Outcomes 0/ })).toBeInTheDocument()
  expect(collection).toHaveTextContent('Kept until manual cleanup')
  expect(collection).toHaveTextContent('2025-01-02')
  const reports = screen.getByRole('region', { name: 'Pair strategy reports' })
  expect(reports).toHaveTextContent('Current report only')
  expect(reports).toHaveTextContent(/previous versions are not retained/i)
  expect(screen.getByRole('region', { name: 'Saved social rankings' })).toHaveTextContent('No saved dates')
  expect(screen.getByLabelText('Saved from (New York)')).toHaveValue('')
  expect(screen.getByLabelText('Saved through (New York)')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Preview cleanup' })).toBeDisabled()
  expect(requests).toEqual([{ path: '/v1/research-archive', method: 'GET', body: undefined }])
})

test('preview uses the explicit inclusive saved date range and shows all affected and protected counts', async () => {
  mount()
  const preview = await loadPreview()
  expect(requests.find((request) => request.path.endsWith('/preview'))).toEqual({
    path: '/v1/research-archive/preview', method: 'POST',
    body: { kind: 'catalyst', date_from: '2026-10-01', date_to: '2026-10-03' },
  })
  expect(preview).toHaveTextContent(/inclusive.*New York/i)
  expect(preview).toHaveTextContent('2026-10-01')
  expect(preview).toHaveTextContent('2026-10-03')
  expect(within(preview).getByRole('row', { name: /Candidates 5/ })).toBeInTheDocument()
  expect(within(preview).getByRole('row', { name: /Observations 7/ })).toBeInTheDocument()
  expect(within(preview).getByRole('row', { name: /Outcomes 0/ })).toBeInTheDocument()
  expect(preview).toHaveTextContent(/3 active records.*protected/i)
  expect(screen.getByRole('button', { name: 'Delete reviewed records' })).toBeDisabled()
  expect(deletionRequests()).toHaveLength(0)
})

test('requires exact confirmation and a separate explicit delete click, then refreshes research caches', async () => {
  const { client } = mount()
  const researchKeys = [
    ['discover', 'fresh-catalysts'], ['research-first', 1], ['system', 'research-observations'], ['catalysts', 'WDC'],
    ['follow-through', 'ticker', 'WDC'], ['ai-research', 'WDC'], ['stock-pairs', 'WDC'],
    ['pair-strategy', 'WDC', 'STX'], ['pair-backtest', 'WDC', 'STX'],
    ['google-finance-competitors', 'WDC'], ['google-finance-market-picks'], ['market-events'],
    ['event-window', 'market-macro', 7], ['setup-event-window', 1], ['research-subscriptions'],
    ['macro', 'sector-impact-dates'], ['stocks', 'WDC', 'score-history'], ['watchlists', 'items', 1],
    ['trending', 'leaderboard'], ['twitter', 'best-stocks'], ['reddit', 'top-mentions'],
  ]
  researchKeys.forEach((key) => client.setQueryData(key, { saved: true }))
  client.setQueryData(['settings'], { enabled: true })
  await loadPreview()
  const button = screen.getByRole('button', { name: 'Delete reviewed records' })
  for (const value of ['delete', ' DELETE', 'DELETE ']) {
    confirmDelete(value)
    expect(button).toBeDisabled()
  }
  confirmDelete()
  expect(button).toBeEnabled()
  expect(deletionRequests()).toHaveLength(0)
  fireEvent.click(button)
  expect(await screen.findByRole('status')).toHaveTextContent(/12 records deleted/i)
  expect(deletionRequests()).toEqual([{
    path: '/v1/research-archive/delete', method: 'POST',
    body: { token: 'reviewed-token', confirmation: 'DELETE' },
  }])
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Saved from (New York)')).toHaveValue('2026-10-01')
  expect(screen.getByLabelText('Saved through (New York)')).toHaveValue('2026-10-03')
  await waitFor(() => expect(requests.filter((request) => request.path === '/v1/research-archive')).toHaveLength(2))
  researchKeys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated, String(key)).toBe(true))
  expect(client.getQueryState(['settings'])?.isInvalidated).toBe(false)
})

test.each(['Saved from (New York)', 'Saved through (New York)'])('changing %s discards a reviewed preview and confirmation', async (label) => {
  mount()
  await loadPreview()
  confirmDelete()
  fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-10-02' } })
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  // The server returns the previous scope; it must not authorize the changed one.
  expect(await screen.findByRole('alert')).toHaveTextContent(/preview.*again/i)
  expect(deletionRequests()).toHaveLength(0)
})

test('changing the collection discards the preview even for an opaque newly catalogued kind', async () => {
  mount()
  await loadPreview()
  confirmDelete()
  await chooseCollection('Saved social rankings')
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  await waitFor(() => expect(requests.filter((request) => request.path.endsWith('/preview'))).toHaveLength(2))
  expect(requests.at(-1)?.body).toEqual({ kind: 'social_curated', date_from: '2026-10-01', date_to: '2026-10-03' })
  expect(deletionRequests()).toHaveLength(0)
})

test('a late preview cannot authorize filters changed away and back to the original range', async () => {
  let resolvePreview!: (response: Response) => void
  previewResponse = () => new Promise((resolve) => { resolvePreview = resolve })
  mount()
  await selectRange()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  await waitFor(() => expect(requests.some((request) => request.path.endsWith('/preview'))).toBe(true))
  const from = screen.getByLabelText('Saved from (New York)')
  fireEvent.change(from, { target: { value: '2026-10-02' } })
  fireEvent.change(from, { target: { value: '2026-10-01' } })
  await act(async () => resolvePreview(jsonResponse(makePreview())))
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test('a replaced preview clears an earlier confirmation', async () => {
  mount()
  await loadPreview()
  confirmDelete()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  await screen.findByRole('region', { name: 'Cleanup preview' })
  expect(screen.getByLabelText('Type DELETE to confirm')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Delete reviewed records' })).toBeDisabled()
  expect(deletionRequests()).toHaveLength(0)
})

test('expiry removes deletion authorization without a request', async () => {
  mount()
  await selectRange()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-13T14:00:00Z'))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
    await vi.advanceTimersByTimeAsync(1)
  })
  confirmDelete()
  expect(screen.getByRole('button', { name: 'Delete reviewed records' })).toBeEnabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000) })
  expect(screen.getByRole('alert')).toHaveTextContent(/preview expired/i)
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test('an already expired server response cannot enable deletion', async () => {
  previewResponse = async () => jsonResponse(makePreview({ expires_at: '2025-01-01T00:00:00Z' }))
  mount()
  await selectRange()
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/preview expired/i)
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test.each([
  ['preview_changed', 409, /saved research changed/i],
  ['preview_expired', 409, /preview expired/i],
  ['invalid_preview', 409, /preview is no longer valid/i],
  ['unknown_failure', 500, /could not complete cleanup/i],
])('a delete error %s invalidates the token and requires a fresh preview', async (code, status, message) => {
  deleteResponse = async () => jsonResponse({ detail: { code } }, status)
  mount()
  await loadPreview()
  confirmDelete()
  fireEvent.click(screen.getByRole('button', { name: 'Delete reviewed records' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  await screen.findByRole('region', { name: 'Cleanup preview' })
  expect(screen.getByLabelText('Type DELETE to confirm')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Delete reviewed records' })).toBeDisabled()
  expect(deletionRequests()).toHaveLength(1)
})

test('a failed new preview discards earlier authorization and explains a narrower range', async () => {
  mount()
  await loadPreview()
  confirmDelete()
  previewResponse = async () => jsonResponse({ detail: { code: 'narrow_range' } }, 422)
  fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/smaller date range/i)
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test('a lost deletion response refreshes research that may already have changed on the server', async () => {
  deleteResponse = async () => { throw new TypeError('Connection lost') }
  const { client } = mount()
  client.setQueryData(['discover', 'fresh-catalysts'], { saved: true })
  client.setQueryData(['ai-research', 'WDC'], { saved: true })
  await loadPreview()
  confirmDelete()
  fireEvent.click(screen.getByRole('button', { name: 'Delete reviewed records' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not complete cleanup/i)
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(client.getQueryState(['discover', 'fresh-catalysts'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(['ai-research', 'WDC'])?.isInvalidated).toBe(true)
  expect(deletionRequests()).toHaveLength(1)
})

test('an inventory refresh error removes authorization until another explicit preview', async () => {
  const { client } = mount()
  await loadPreview()
  confirmDelete()
  inventoryResponse = async () => jsonResponse({ detail: 'Unavailable' }, 503)
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['research-archive'] })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load saved research/i)
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  inventoryResponse = async () => jsonResponse(savedArchive)
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(screen.queryByRole('region', { name: 'Cleanup preview' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test('empty and reversed ranges never request a preview or deletion', async () => {
  mount()
  await chooseCollection()
  const preview = screen.getByRole('button', { name: 'Preview cleanup' })
  expect(preview).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Saved from (New York)'), { target: { value: '2026-10-04' } })
  fireEvent.change(screen.getByLabelText('Saved through (New York)'), { target: { value: '2026-10-01' } })
  expect(preview).toBeDisabled()
  expect(screen.getByLabelText('Saved through (New York)')).toHaveAttribute('aria-invalid', 'true')
  expect(requests).toHaveLength(1)
})

test('a zero-count preview shows protected records but cannot be deleted', async () => {
  previewResponse = async () => jsonResponse(makePreview({
    counts: [{ key: 'candidates', label: 'Candidates', count: 0 }], total_records: 0,
  }))
  mount()
  const preview = await loadPreview()
  expect(preview).toHaveTextContent(/no records to delete/i)
  expect(preview).toHaveTextContent(/3 active records.*protected/i)
  expect(screen.queryByRole('button', { name: 'Delete reviewed records' })).not.toBeInTheDocument()
  expect(deletionRequests()).toHaveLength(0)
})

test('cleanup stays locked while one explicit deletion is in flight', async () => {
  let resolveDelete!: (response: Response) => void
  deleteResponse = () => new Promise((resolve) => { resolveDelete = resolve })
  mount()
  await loadPreview()
  confirmDelete()
  fireEvent.click(screen.getByRole('button', { name: 'Delete reviewed records' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'Preview cleanup' })).toBeDisabled()
  expect(screen.getByLabelText('Saved from (New York)')).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Research collection' })).toBeDisabled()
  expect(deletionRequests()).toHaveLength(1)
  await act(async () => resolveDelete(jsonResponse({
    kind: 'catalyst', counts: makePreview().counts, total_records: 12, deleted_at: '2026-10-13T14:01:00Z',
  })))
  expect(await screen.findByRole('status')).toHaveTextContent(/12 records deleted/i)
})
