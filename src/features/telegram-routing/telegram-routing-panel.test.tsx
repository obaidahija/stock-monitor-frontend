import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { TelegramRouteOut, TelegramStatusOut } from '@/types/api'
import { TelegramRoutingPanel } from './telegram-routing-panel'

const api = vi.hoisted(() => ({
  getTelegramRoutingStatus: vi.fn(),
  saveTelegramRoute: vi.fn(),
  clearTelegramRoute: vi.fn(),
  sendTelegramCategoryTest: vi.fn(),
  setupTelegramTopics: vi.fn(),
}))

vi.mock('@/api/telegram', () => api)

function route(overrides: Partial<TelegramRouteOut>): TelegramRouteOut {
  return {
    category: 'digest',
    name: 'Digest',
    chat_id: '-100123',
    thread_id: null,
    topic_name: null,
    source: 'default',
    ready: true,
    error: null,
    ...overrides,
  }
}

const status: TelegramStatusOut = {
  configured: true,
  ready: true,
  error: null,
  digest_enabled: true,
  routes: [
    route({ category: 'digest', name: 'Digest', thread_id: 12, topic_name: 'Digest', source: 'route' }),
    route({ category: 'earnings', name: 'Earnings', thread_id: 14, source: 'route' }),
    route({ category: 'filings', name: 'Filings' }),
    route({ category: 'insider', name: 'Insider – Form 144' }),
    route({
      category: 'major_holders',
      name: 'Major holders – 13D',
      ready: false,
      error: 'The bot is not a member of this chat',
    }),
    route({ category: 'watchlist', name: 'Watchlist' }),
  ],
}

function row(name: string) {
  return screen.getByRole('row', { name: new RegExp(name) })
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  api.getTelegramRoutingStatus.mockResolvedValue(status)
})

test('lists six categories with their destinations', async () => {
  renderWithProviders(<TelegramRoutingPanel />)

  await waitFor(() => expect(row('Digest')).toBeInTheDocument())
  expect(within(row('Digest')).getByText(/topic 12 "Digest"/)).toBeInTheDocument()
  expect(within(row('Filings')).getByText('default chat')).toBeInTheDocument()
  expect(within(row('Major holders')).getByText('The bot is not a member of this chat')).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(7)
})

test('setup topics sends chat id and shows outcomes', async () => {
  api.setupTelegramTopics.mockResolvedValue({
    chat_id: '-100123',
    items: status.routes!.map((r) => ({ category: r.category, name: r.name, thread_id: 1, outcome: 'created' })),
    error: null,
  })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  await userEvent.type(screen.getByLabelText('Forum group chat ID'), '-100123')
  await userEvent.click(screen.getByRole('button', { name: 'Set up topics' }))

  await waitFor(() => expect(api.setupTelegramTopics).toHaveBeenCalledWith('-100123'))
  expect(await screen.findAllByText('Created')).toHaveLength(6)
})

test('setup error is shown in plain words', async () => {
  api.setupTelegramTopics.mockRejectedValue(new ApiError(422, "Turn on Topics in this group's settings"))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: 'Set up topics' }))

  expect(await screen.findByText("Turn on Topics in this group's settings")).toBeInTheDocument()
  expect(api.setupTelegramTopics).toHaveBeenCalledWith(undefined)
})

test('edit by link saves the route', async () => {
  api.saveTelegramRoute.mockResolvedValue(route({ category: 'earnings', source: 'route' }))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Earnings')).toBeInTheDocument())

  await userEvent.click(within(row('Earnings')).getByRole('button', { name: 'Edit' }))
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Topic link'), 'https://t.me/c/123/45')
  await userEvent.click(save)

  await waitFor(() =>
    expect(api.saveTelegramRoute).toHaveBeenCalledWith('earnings', { link: 'https://t.me/c/123/45' }),
  )
})

test('edit by chat id and topic id saves the route', async () => {
  api.saveTelegramRoute.mockResolvedValue(route({ category: 'insider', source: 'route' }))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Insider')).toBeInTheDocument())

  await userEvent.click(within(row('Insider')).getByRole('button', { name: 'Edit' }))
  await userEvent.type(screen.getByLabelText('Chat ID'), '-1009')
  await userEvent.type(screen.getByLabelText('Topic ID'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(api.saveTelegramRoute).toHaveBeenCalledWith('insider', { chat_id: '-1009', thread_id: 3 }),
  )
})

test('test button sends category test', async () => {
  api.sendTelegramCategoryTest.mockResolvedValue({ sent: true })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Insider')).toBeInTheDocument())

  await userEvent.click(within(row('Insider')).getByRole('button', { name: 'Test' }))

  await waitFor(() => expect(api.sendTelegramCategoryTest).toHaveBeenCalledWith('insider'))
  expect(await within(row('Insider')).findByText('Test sent')).toBeInTheDocument()
})

test('clear only shown for routed categories', async () => {
  api.clearTelegramRoute.mockResolvedValue(undefined)
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  expect(within(row('Filings')).queryByRole('button', { name: 'Clear' })).toBeNull()
  await userEvent.click(within(row('Digest')).getByRole('button', { name: 'Clear' }))

  await waitFor(() => expect(api.clearTelegramRoute).toHaveBeenCalledWith('digest'))
})
