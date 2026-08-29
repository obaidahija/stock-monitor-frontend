import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ResearchChat } from './research-chat'

const api = vi.hoisted(() => ({
  createAiConversation: vi.fn(),
  deleteAiConversation: vi.fn(),
  getAiConversation: vi.fn(),
  listAiConversations: vi.fn(),
  streamAiConversationMessage: vi.fn(),
}))

vi.mock('@/api/ai', async (loadOriginal) => ({
  ...(await loadOriginal<typeof import('@/api/ai')>()),
  ...api,
}))

const conversation = {
  id: 7,
  ticker: 'NVDA',
  provider: 'openrouter',
  model: 'qwen/qwen3.8-27b',
  reasoning_enabled: true,
  streaming_enabled: true,
  title: 'Earnings review',
  created_at: '2026-08-29T10:00:00Z',
  updated_at: '2026-08-29T10:00:00Z',
}

const detail = {
  ...conversation,
  messages: [
    {
      id: 1,
      role: 'user',
      content: 'What changed after earnings?',
      attachment_names: [],
      status: 'complete',
      created_at: '2026-08-29T10:00:00Z',
      usage: null,
    },
    {
      id: 2,
      role: 'assistant',
      content: '**Margins improved** while guidance stayed cautious.',
      attachment_names: [],
      status: 'complete',
      created_at: '2026-08-29T10:00:05Z',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 30,
        reasoning_tokens: 8,
        cached_tokens: 0,
        cost_usd: '0.00120000',
      },
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 30,
    reasoning_tokens: 8,
    cached_tokens: 0,
    cost_usd: '0.00120000',
  },
}

beforeEach(() => {
  cleanup()
  for (const mock of Object.values(api)) mock.mockReset()
  api.listAiConversations.mockResolvedValue([conversation])
  api.getAiConversation.mockResolvedValue(detail)
  api.createAiConversation.mockResolvedValue(conversation)
  api.deleteAiConversation.mockResolvedValue(undefined)
})

test('restores visible history and conversation usage without exposing reasoning', async () => {
  renderWithProviders(<ResearchChat ticker="NVDA" />)

  expect(await screen.findByText('What changed after earnings?')).toBeInTheDocument()
  expect(screen.getByText('Margins improved')).toBeInTheDocument()
  expect(screen.getAllByText('$0.0012').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/130 tokens/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/private reasoning/i)).not.toBeInTheDocument()
  expect(screen.getByText('qwen/qwen3.8-27b')).toBeInTheDocument()
})

test('streams deltas through generic thinking and replaces the pending message', async () => {
  const user = userEvent.setup()
  api.streamAiConversationMessage.mockImplementation(
    async (_id, _form, _signal, onEvent) => {
      onEvent({ event: 'started', data: { conversation_id: 7, provider: 'openrouter', model: 'qwen' } })
      onEvent({ event: 'thinking', data: { active: true } })
      await Promise.resolve()
      onEvent({ event: 'text_delta', data: { text: 'Fresh ' } })
      onEvent({ event: 'text_delta', data: { text: 'analysis' } })
      onEvent({
        event: 'usage',
        data: {
          prompt_tokens: 20,
          completion_tokens: 4,
          reasoning_tokens: 2,
          cached_tokens: 0,
          cost_usd: '0.00030000',
        },
      })
      onEvent({
        event: 'completed',
        data: {
          message: {
            id: 9,
            role: 'assistant',
            content: 'Fresh analysis',
            attachment_names: [],
            status: 'complete',
            created_at: '2026-08-29T10:01:00Z',
          },
          finish_reason: 'stop',
        },
      })
    },
  )
  renderWithProviders(<ResearchChat ticker="NVDA" />)
  await screen.findByText('What changed after earnings?')

  await user.type(screen.getByPlaceholderText('Ask a research follow-up…'), 'What now?')
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  expect(await screen.findByText('Fresh analysis')).toBeInTheDocument()
  expect(screen.getByText('$0.0003')).toBeInTheDocument()
  expect(screen.queryByText('Thinking…')).not.toBeInTheDocument()
  expect(api.streamAiConversationMessage).toHaveBeenCalledOnce()
})

test('creates a conversation and forwards the automatic-chart option', async () => {
  api.listAiConversations.mockResolvedValue([])
  api.getAiConversation.mockResolvedValue({ ...detail, messages: [] })
  api.streamAiConversationMessage.mockResolvedValue(undefined)
  const user = userEvent.setup()
  renderWithProviders(<ResearchChat ticker="NVDA" />)

  await user.click(await screen.findByRole('button', { name: 'New conversation' }))
  await user.type(screen.getByPlaceholderText('Ask a research follow-up…'), 'Read the setup')
  await user.click(screen.getByRole('switch', { name: 'Include MarketScout chart' }))
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  expect(api.createAiConversation).toHaveBeenCalledWith('NVDA')
  const form = api.streamAiConversationMessage.mock.calls[0][1] as FormData
  expect(form.get('include_chart')).toBe('true')
})

test('validates attachment count and can stop an active turn', async () => {
  const user = userEvent.setup()
  api.streamAiConversationMessage.mockImplementation(
    (_id, _form, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )
  renderWithProviders(<ResearchChat ticker="NVDA" />)
  await screen.findByText('What changed after earnings?')

  const files = Array.from(
    { length: 5 },
    (_, index) => new File(['png'], `chart-${index}.png`, { type: 'image/png' }),
  )
  await user.upload(screen.getByLabelText('Upload files'), files)
  expect(await screen.findByText(/at most four attachments/i)).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText('Ask a research follow-up…'), 'Keep going')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByRole('button', { name: 'Stop' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Stop' }))
  await waitFor(() =>
    expect(screen.getByPlaceholderText('Ask a research follow-up…')).toBeEnabled(),
  )
})

test('offers retry only for retryable stream errors', async () => {
  const user = userEvent.setup()
  api.streamAiConversationMessage.mockImplementation(
    async (_id, _form, _signal, onEvent) => {
      onEvent({
        event: 'error',
        data: { code: 429, message: 'Rate limited', retryable: true },
      })
    },
  )
  renderWithProviders(<ResearchChat ticker="NVDA" />)
  await screen.findByText('What changed after earnings?')

  await user.type(screen.getByPlaceholderText('Ask a research follow-up…'), 'Try this')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await user.click(await screen.findByRole('button', { name: 'Retry' }))

  expect(api.streamAiConversationMessage).toHaveBeenCalledTimes(2)
})
