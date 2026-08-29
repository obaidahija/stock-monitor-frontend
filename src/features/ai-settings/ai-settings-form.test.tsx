import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AiSettingsForm } from './ai-settings-form'

const api = vi.hoisted(() => ({
  getAiSettings: vi.fn(),
  getOpenRouterModels: vi.fn(),
  updateAiSettings: vi.fn(),
}))

vi.mock('@/api/ai', () => api)

const settings = {
  research: {
    provider: 'openrouter',
    model: 'qwen/qwen3.8-27b',
    reasoning_enabled: true,
    streaming_enabled: true,
    include_chart: true,
  },
  summarization: { provider: 'ollama', model: 'qwen3:8b' },
  providers: {
    ollama: { configured: true },
    llamacpp: { configured: true },
    anthropic: { configured: false },
    openrouter: { configured: true },
  },
  updated_at: '2026-08-29T10:00:00Z',
}

beforeEach(() => {
  cleanup()
  api.getAiSettings.mockReset()
  api.getOpenRouterModels.mockReset()
  api.updateAiSettings.mockReset()
  api.getAiSettings.mockResolvedValue(settings)
  api.getOpenRouterModels.mockResolvedValue([
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B',
      context_length: 131072,
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      supported_parameters: ['reasoning'],
      prompt_price: '0.0000002',
      completion_price: '0.0000006',
    },
  ])
  api.updateAiSettings.mockResolvedValue(settings)
})

test('loads independent profiles, readiness, and OpenRouter model metadata', async () => {
  renderWithProviders(<AiSettingsForm />)

  expect(await screen.findByRole('heading', { name: 'Research' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Summarization' })).toBeInTheDocument()
  expect(await screen.findByText('Qwen 3.8 27B')).toBeInTheDocument()
  expect(screen.getByText('131,072 context')).toBeInTheDocument()
  expect(screen.getByText('Image input')).toBeInTheDocument()
  expect(screen.getByText('OpenRouter key configured')).toBeInTheDocument()
  expect(screen.getByDisplayValue('qwen3:8b')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Reasoning' })).toBeChecked()
  expect(screen.getByRole('switch', { name: 'Streaming' })).toBeChecked()
  expect(screen.getByRole('switch', { name: 'Automatic chart inclusion' })).toBeChecked()
})

test('saves research and summarization settings without sending secrets', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await screen.findByRole('heading', { name: 'Research' })

  await user.clear(screen.getByLabelText('Summarization model'))
  await user.type(screen.getByLabelText('Summarization model'), 'qwen3:14b')
  await user.click(screen.getByRole('switch', { name: 'Automatic chart inclusion' }))
  await user.click(screen.getByRole('button', { name: 'Save AI settings' }))

  expect(api.updateAiSettings.mock.calls[0][0]).toEqual({
    research: {
      provider: 'openrouter',
      model: 'qwen/qwen3.8-27b',
      reasoning_enabled: true,
      streaming_enabled: true,
      include_chart: false,
    },
    summarization: { provider: 'ollama', model: 'qwen3:14b' },
  })
  expect(JSON.stringify(api.updateAiSettings.mock.calls[0])).not.toContain('api_key')
})

test('falls back to a manual OpenRouter model field when catalog discovery fails', async () => {
  api.getOpenRouterModels.mockRejectedValue(new Error('catalog unavailable'))

  renderWithProviders(<AiSettingsForm />)

  expect(await screen.findByText(/catalog is unavailable/i)).toBeInTheDocument()
  expect(screen.getByLabelText('Research model')).toHaveValue('qwen/qwen3.8-27b')
})
