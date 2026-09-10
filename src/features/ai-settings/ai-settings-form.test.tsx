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
    context_window_tokens: 131072,
  },
  summarization: { provider: 'ollama', model: 'qwen3:8b', context_window_tokens: 4096 },
  competitor: {
    provider: 'ollama',
    model: 'qwen3:8b',
    max_tokens: 4000,
    context_window_tokens: 8192,
  },
  macro_transmission: {
    provider: 'ollama',
    model: 'qwen3:8b',
    max_tokens: 200,
    context_window_tokens: 4096,
  },
  providers: {
    ollama: {
      configured: true,
      default_model: 'gpt-oss:20b',
      default_context_window_tokens: 4096,
    },
    llamacpp: {
      configured: true,
      default_model: 'local',
      default_context_window_tokens: 4096,
    },
    anthropic: {
      configured: false,
      default_model: 'claude-sonnet-4-5-20250929',
      default_context_window_tokens: 32768,
    },
    openrouter: {
      configured: true,
      default_model: 'qwen/qwen3.8-27b',
      default_context_window_tokens: 32768,
    },
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
    {
      id: 'z-ai/glm-5.2:free',
      name: 'Z-AI GLM 5.2 (free)',
      context_length: 256000,
      input_modalities: ['text'],
      output_modalities: ['text'],
      supported_parameters: [],
      prompt_price: '0',
      completion_price: '0',
    },
    {
      // Free without a :free suffix -- pricing decides, not the name.
      id: 'google/lyria-3-pro-preview',
      name: 'Lyria 3 Pro Preview',
      context_length: 1048576,
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      supported_parameters: [],
      prompt_price: '0',
      completion_price: '0',
    },
  ])
  api.updateAiSettings.mockResolvedValue(settings)
})

test('loads independent profiles, readiness, and OpenRouter model metadata', async () => {
  renderWithProviders(<AiSettingsForm />)

  expect(await screen.findByRole('heading', { name: 'Research' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Summarization' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Competitor identification' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Macro transmission' })).toBeInTheDocument()
  expect(screen.getByLabelText('Competitor max tokens')).toHaveValue(4000)
  expect(screen.getByLabelText('Macro transmission max tokens')).toHaveValue(200)
  expect(screen.getByLabelText('Research context window')).toHaveValue(131072)
  expect(screen.getByLabelText('Summarization context window')).toHaveValue(4096)
  expect(screen.getByLabelText('Competitor context window')).toHaveValue(8192)
  expect(screen.getByLabelText('Macro transmission context window')).toHaveValue(4096)
  expect(await screen.findByText('Qwen 3.8 27B')).toBeInTheDocument()
  expect(screen.getByText('131,072 context')).toBeInTheDocument()
  expect(screen.getByText('Image input')).toBeInTheDocument()
  expect(screen.getByText('OpenRouter key configured')).toBeInTheDocument()
  expect(screen.getByLabelText('Summarization model')).toHaveValue('qwen3:8b')
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
      context_window_tokens: 131072,
    },
    summarization: {
      provider: 'ollama',
      model: 'qwen3:14b',
      context_window_tokens: 4096,
    },
    competitor: {
      provider: 'ollama',
      model: 'qwen3:8b',
      max_tokens: 4000,
      context_window_tokens: 8192,
    },
    macro_transmission: {
      provider: 'ollama',
      model: 'qwen3:8b',
      max_tokens: 200,
      context_window_tokens: 4096,
    },
  })
  expect(JSON.stringify(api.updateAiSettings.mock.calls[0])).not.toContain('api_key')
})

test('falls back to a manual OpenRouter model field when catalog discovery fails', async () => {
  api.getOpenRouterModels.mockRejectedValue(new Error('catalog unavailable'))

  renderWithProviders(<AiSettingsForm />)

  expect(await screen.findByText(/catalog is unavailable/i)).toBeInTheDocument()
  expect(screen.getByLabelText('Research model')).toHaveValue('qwen/qwen3.8-27b')
})

test("resets the model to the new provider's default when the provider changes", async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await screen.findByRole('heading', { name: 'Research' })

  // Summarization starts on ollama/qwen3:8b.
  expect(screen.getByLabelText('Summarization model')).toHaveValue('qwen3:8b')

  await user.click(screen.getByLabelText('Summarization provider'))
  await user.click(await screen.findByRole('option', { name: 'Anthropic' }))

  expect(screen.getByLabelText('Summarization model')).toHaveValue(
    'claude-sonnet-4-5-20250929',
  )
  expect(screen.getByLabelText('Summarization context window')).toHaveValue(32768)
})

test('restores the saved model when switching back to the saved provider', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await screen.findByRole('heading', { name: 'Research' })

  await user.click(screen.getByLabelText('Summarization provider'))
  await user.click(await screen.findByRole('option', { name: 'Anthropic' }))
  await user.click(screen.getByLabelText('Summarization provider'))
  await user.click(await screen.findByRole('option', { name: 'Ollama' }))

  // Back to the persisted provider, so the persisted model returns rather
  // than the env default (gpt-oss:20b).
  expect(screen.getByLabelText('Summarization model')).toHaveValue('qwen3:8b')
})

// The catalog select only replaces the manual model input once the models
// query resolves, so wait for a catalog-only element before interacting.
async function openResearchCatalog(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole('combobox', { name: 'Research model' })
  await user.click(trigger)
  return screen.findByPlaceholderText('Search OpenRouter models…')
}

test('filters the catalog to free models, including ones without a :free suffix', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await openResearchCatalog(user)

  expect(screen.getByRole('option', { name: /Qwen 3.8 27B/ })).toBeInTheDocument()

  await user.click(screen.getByRole('switch', { name: 'Free models only' }))

  expect(screen.getByRole('option', { name: /Z-AI GLM 5.2 \(free\)/ })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /Lyria 3 Pro Preview/ })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: /Qwen 3.8 27B/ })).not.toBeInTheDocument()
})

test('shows a Free badge instead of zero prices for a free model', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await openResearchCatalog(user)

  await user.click(screen.getByRole('option', { name: /Z-AI GLM 5.2 \(free\)/ }))

  expect(screen.getByText('Free')).toBeInTheDocument()
  expect(screen.queryByText('Input $0/token')).not.toBeInTheDocument()
  expect(screen.queryByText('Output $0/token')).not.toBeInTheDocument()
})

test('selecting a catalog model saves its reported context window', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AiSettingsForm />)
  await openResearchCatalog(user)

  await user.click(screen.getByRole('option', { name: /Lyria 3 Pro Preview/ }))
  expect(screen.getByLabelText('Research context window')).toHaveValue(1048576)
  await user.click(screen.getByRole('button', { name: 'Save AI settings' }))

  expect(api.updateAiSettings.mock.calls[0][0].research).toMatchObject({
    model: 'google/lyria-3-pro-preview',
    context_window_tokens: 1048576,
  })
})
