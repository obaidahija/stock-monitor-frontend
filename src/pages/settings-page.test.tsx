import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from './settings-page'
import * as api from '@/api/settings'
import type { SettingsOut } from '@/types/api'

vi.mock('@/api/settings')
vi.mock('@/features/ai-settings/ai-settings-form', () => ({
  AiSettingsForm: () => <div>AI settings form</div>,
}))

const payload: SettingsOut = {
  categories: [
    {
      name: 'discovery',
      label: 'Discovery & Scoring',
      fields: [
        {
          name: 'mention_spike_min_count',
          label: 'Mention spike min count',
          kind: 'int',
          description: 'Minimum same-day mentions.',
          value: 5,
          default: 5,
          is_overridden: false,
          requires_restart: false,
          minimum: 1,
          maximum: 100,
        },
      ],
    },
    {
      name: 'reddit',
      label: 'Reddit',
      fields: [
        {
          name: 'reddit_intelligence_enabled',
          label: 'Reddit intelligence enabled',
          kind: 'bool',
          description: 'Master switch for live rdt-cli work.',
          value: false,
          default: false,
          is_overridden: false,
          requires_restart: false,
          minimum: null,
          maximum: null,
        },
      ],
    },
  ],
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  // vitest runs without `globals`, so RTL never registers its auto-cleanup.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getSettings).mockResolvedValue(payload)
  })

  it('lists every category plus AI', async () => {
    renderPage()
    // Wait on a category button, not the AI one -- AI renders before the
    // query resolves, so waiting on it would not wait for the data at all.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Discovery & Scoring' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'AI' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reddit' })).toBeInTheDocument()
  })

  it('shows the AI settings form by default', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('AI settings form')).toBeInTheDocument())
  })

  it('switches to a selected category', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reddit' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Reddit' }))
    expect(screen.getByLabelText('Reddit intelligence enabled')).toBeInTheDocument()
  })
})
