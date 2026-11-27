import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
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
    chat_title: 'Scout Topics',
    thread_id: null,
    topic_name: null,
    source: 'default',
    ready: true,
    error: null,
    last_sent_at: null,
    last_failure_at: null,
    last_error: null,
    consecutive_failures: 0,
    ...overrides,
  }
}

const status: TelegramStatusOut = {
  configured: true,
  ready: true,
  error: null,
  digest_enabled: true,
  bot_ready: true,
  bot_username: 'ScoutBot',
  bot_error: null,
  default_chat_id: '-100123',
  default_chat_title: 'Scout Topics',
  routes: [
    route({ category: 'digest', name: 'Digest', thread_id: 12, topic_name: 'Digest', source: 'route' }),
    route({ category: 'earnings', name: 'Earnings', thread_id: 14, source: 'route' }),
    route({ category: 'filings', name: 'Filings', last_sent_at: '2026-11-27T13:05:00Z' }),
    route({ category: 'insider', name: 'Insider – Form 144' }),
    route({
      category: 'major_holders',
      name: 'Major holders – 13D',
      ready: false,
      error: 'The bot is not a member of this chat',
    }),
    route({
      category: 'watchlist',
      name: 'Watchlist',
      source: 'route',
      thread_id: 31,
      consecutive_failures: 2,
      last_failure_at: '2026-11-27T14:10:00Z',
      last_error: 'Bad Request: message thread not found',
    }),
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
  expect(within(row('Digest')).getByText('Scout Topics › Digest')).toBeInTheDocument()
  expect(within(row('Digest')).getByText('-100123 · topic 12')).toBeInTheDocument()
  expect(within(row('Earnings')).getByText('Scout Topics › topic 14')).toBeInTheDocument()
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

  await userEvent.type(screen.getByLabelText(/Forum group/), '-100123')
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

  await userEvent.click(within(row('Filings')).getByRole('button', { name: 'Edit' }))
  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Topic link'), 'https://t.me/c/123/45')
  await userEvent.click(save)

  await waitFor(() =>
    expect(api.saveTelegramRoute).toHaveBeenCalledWith('filings', { link: 'https://t.me/c/123/45' }),
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

test('manual routing preserves malformed topic IDs and blocks them without blocking a topic link', async () => {
  api.saveTelegramRoute.mockResolvedValue(route({ source: 'route' }))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  await userEvent.click(within(row('Digest')).getByRole('button', { name: 'Edit' }))
  const topic = screen.getByLabelText('Topic ID')
  const save = screen.getByRole('button', { name: 'Save' })
  for (const invalid of ['-12', '1.2', '1e2', '12a34', ' 12 ', '0', '2147483648']) {
    await userEvent.clear(topic)
    await userEvent.type(topic, invalid)
    expect(topic).toHaveValue(invalid)
    expect(topic).toHaveAccessibleDescription(/1 to 2,147,483,647/)
    expect(save).toBeDisabled()
  }
  await userEvent.click(save)
  expect(api.saveTelegramRoute).not.toHaveBeenCalled()

  await userEvent.clear(topic)
  expect(save).toBeEnabled()
  await userEvent.type(topic, '2147483647')
  expect(save).toBeEnabled()
  await userEvent.type(topic, '8')
  await userEvent.type(screen.getByLabelText('Topic link'), 'https://t.me/c/123/45')
  expect(topic).toBeDisabled()
  await userEvent.click(save)
  expect(api.saveTelegramRoute).toHaveBeenCalledWith('digest', { link: 'https://t.me/c/123/45' })
})

test('test button sends category test', async () => {
  api.sendTelegramCategoryTest.mockResolvedValue({ sent: true })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Insider')).toBeInTheDocument())

  await userEvent.click(within(row('Insider')).getByRole('button', { name: 'Test' }))

  await waitFor(() => expect(api.sendTelegramCategoryTest).toHaveBeenCalledWith('insider'))
  expect(await within(row('Insider')).findByText('Test sent')).toBeInTheDocument()
})

test('a rejected test send refreshes the recorded delivery failure', async () => {
  api.sendTelegramCategoryTest.mockImplementationOnce(async () => {
    api.getTelegramRoutingStatus.mockResolvedValue({
      ...status,
      routes: status.routes!.map((current) =>
        current.category === 'digest'
          ? {
              ...current,
              consecutive_failures: 1,
              last_failure_at: '2026-11-27T15:10:00Z',
              last_error: 'Bot was removed from the chat',
            }
          : current,
      ),
    })
    throw new ApiError(502, 'Could not send the Telegram test')
  })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())
  const digest = within(row('Digest'))
  await userEvent.click(digest.getByRole('button', { name: 'Test' }))

  expect(await digest.findByText('Could not send the Telegram test')).toBeInTheDocument()
  expect(await digest.findByText(/1 failed in a row/)).toHaveTextContent(
    'Bot was removed from the chat',
  )
})

test('changing a destination drops test feedback and detaches earlier pending tests', async () => {
  let routes = status.routes!
  api.getTelegramRoutingStatus.mockImplementation(async () => ({ ...status, routes }))
  api.sendTelegramCategoryTest.mockResolvedValue({ sent: true })
  api.saveTelegramRoute.mockImplementationOnce(async () => {
    const saved = route({ source: 'route', thread_id: 32 })
    routes = [saved, ...routes.slice(1)]
    return saved
  })
  api.clearTelegramRoute.mockImplementation(async () => {
    routes = [route({}), ...routes.slice(1)]
  })
  api.setupTelegramTopics.mockImplementation(async () => {
    routes = [route({ source: 'route', thread_id: 12, topic_name: 'Digest' }), ...routes.slice(1)]
    return {
      chat_id: '-100123',
      items: [{ category: 'digest', name: 'Digest', thread_id: 12, outcome: 'kept' }],
      error: null,
    }
  })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())
  const digest = () => within(row('Digest'))
  const testButton = () => digest().getByRole('button', { name: 'Test' })

  await userEvent.click(testButton())
  expect(await digest().findByText('Test sent')).toBeInTheDocument()
  await userEvent.click(digest().getByRole('button', { name: 'Edit' }))
  const topic = screen.getByLabelText('Topic ID')
  await userEvent.clear(topic)
  await userEvent.type(topic, '32')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await digest().findByText('Scout Topics › topic 32')).toBeInTheDocument()
  expect(digest().queryByText('Test sent')).toBeNull()

  api.sendTelegramCategoryTest.mockRejectedValueOnce(new ApiError(502, 'Old test failed'))
  await userEvent.click(testButton())
  expect(await digest().findByText('Old test failed')).toBeInTheDocument()
  await userEvent.click(digest().getByRole('button', { name: 'Clear' }))

  expect(await digest().findByText('default chat')).toBeInTheDocument()
  expect(digest().queryByText('Old test failed')).toBeNull()

  let finishTest!: (value: { sent: true }) => void
  const testResult = new Promise<{ sent: true }>((resolve) => {
    finishTest = resolve
  })
  api.sendTelegramCategoryTest.mockReturnValueOnce(testResult)
  await userEvent.click(testButton())
  expect(testButton()).toBeDisabled()
  await userEvent.click(digest().getByRole('button', { name: 'Edit' }))
  await userEvent.type(screen.getByLabelText('Chat ID'), '-100999')
  await userEvent.click(screen.getByRole('button', { name: 'Set up topics' }))

  expect(await digest().findByText('Scout Topics › Digest')).toBeInTheDocument()
  expect(screen.getByLabelText('Chat ID')).toHaveValue('-100999')
  expect(testButton()).toBeEnabled()

  await userEvent.click(digest().getByRole('button', { name: 'Clear' }))
  expect(await digest().findByText('default chat')).toBeInTheDocument()
  expect(testButton()).toBeEnabled()

  await act(async () => finishTest({ sent: true }))
  expect(digest().queryByText('Test sent')).toBeNull()
})

test('clear only shown for routed categories', async () => {
  api.clearTelegramRoute.mockResolvedValue(undefined)
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  expect(within(row('Filings')).queryByRole('button', { name: 'Clear' })).toBeNull()
  await userEvent.click(within(row('Digest')).getByRole('button', { name: 'Clear' }))

  await waitFor(() => expect(api.clearTelegramRoute).toHaveBeenCalledWith('digest'))
})

test('shows a clear failure in the affected route row and allows a retry', async () => {
  api.clearTelegramRoute.mockRejectedValue(new ApiError(503, 'Could not clear the Telegram route'))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  const digest = within(row('Digest'))
  const clear = digest.getByRole('button', { name: 'Clear' })
  await userEvent.click(clear)

  expect(await digest.findByRole('alert')).toHaveTextContent('Could not clear the Telegram route')
  expect(clear).toBeEnabled()
})

test('names the bot and the default chat', async () => {
  renderWithProviders(<TelegramRoutingPanel />)

  expect(await screen.findByText('@ScoutBot')).toBeInTheDocument()
  expect(screen.getByText(/Default chat/)).toHaveTextContent('Scout Topics')
})

test('a broken bot token is reported on the bot line, not as the default chat', async () => {
  api.getTelegramRoutingStatus.mockResolvedValue({
    ...status,
    bot_ready: false,
    bot_username: null,
    bot_error: 'Unauthorized',
  })
  renderWithProviders(<TelegramRoutingPanel />)

  expect(await screen.findByText(/Bot:/)).toHaveTextContent('Unauthorized')
})

test('shows when each category last delivered or that it keeps failing', async () => {
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Watchlist')).toBeInTheDocument())

  expect(within(row('Filings')).getByText(/Last sent/)).toBeInTheDocument()
  expect(within(row('Watchlist')).getByText(/2 failed in a row/)).toHaveTextContent(
    'Bad Request: message thread not found',
  )
})

test('editing a routed category starts from its current chat and topic', async () => {
  api.saveTelegramRoute.mockResolvedValue(route({ category: 'earnings', source: 'route' }))
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Earnings')).toBeInTheDocument())

  await userEvent.click(within(row('Earnings')).getByRole('button', { name: 'Edit' }))

  expect(screen.getByLabelText('Chat ID')).toHaveValue('-100123')
  expect(screen.getByLabelText('Topic ID')).toHaveValue('14')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(api.saveTelegramRoute).toHaveBeenCalledWith('earnings', { chat_id: '-100123', thread_id: 14 }),
  )
})

test('setup reports topics it recreated', async () => {
  api.setupTelegramTopics.mockResolvedValue({
    chat_id: '-100123',
    items: [{ category: 'earnings', name: 'Earnings', thread_id: 21, outcome: 'recreated' }],
    error: null,
  })
  renderWithProviders(<TelegramRoutingPanel />)
  await waitFor(() => expect(row('Digest')).toBeInTheDocument())

  await userEvent.type(screen.getByLabelText(/Forum group/), 'https://t.me/c/123/5')
  await userEvent.click(screen.getByRole('button', { name: 'Set up topics' }))

  expect(await screen.findByText('Recreated')).toBeInTheDocument()
  expect(api.setupTelegramTopics).toHaveBeenCalledWith('https://t.me/c/123/5')
})
