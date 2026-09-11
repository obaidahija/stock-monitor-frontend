import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsCategoryForm } from './category-form'
import * as api from '@/api/settings'
import type { SettingsCategory } from '@/types/api'

vi.mock('@/api/settings')

const category: SettingsCategory = {
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
    {
      name: 'mention_spike_min_prior_days',
      label: 'Mention spike min prior days',
      kind: 'int',
      description: 'Prior appearances required.',
      value: 3,
      default: 3,
      is_overridden: false,
      requires_restart: false,
      minimum: 1,
      maximum: 30,
    },
  ],
}

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SettingsCategoryForm category={category} />
    </QueryClientProvider>,
  )
}

describe('SettingsCategoryForm', () => {
  // vitest runs without `globals`, so RTL never registers its auto-cleanup.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.updateSettingsCategory).mockResolvedValue(category)
    vi.mocked(api.resetSettingsCategory).mockResolvedValue(category)
  })

  it('renders every field in the category', () => {
    renderForm()
    expect(screen.getByLabelText('Mention spike min count')).toBeInTheDocument()
    expect(screen.getByLabelText('Mention spike min prior days')).toBeInTheDocument()
  })

  it('save is disabled until something changes', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Mention spike min count'), {
      target: { value: '9' },
    })
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })

  it('sends only the changed fields', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Mention spike min count'), {
      target: { value: '9' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(api.updateSettingsCategory).toHaveBeenCalledWith('discovery', {
        mention_spike_min_count: 9,
      }),
    )
  })

  it('resets the category', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => expect(api.resetSettingsCategory).toHaveBeenCalledWith('discovery'))
  })

  it('shows a server validation error without losing edits', async () => {
    vi.mocked(api.updateSettingsCategory).mockRejectedValue(new Error('Input should be >= 1'))
    renderForm()
    fireEvent.change(screen.getByLabelText('Mention spike min count'), {
      target: { value: '9' },
    })
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(screen.getByText(/Input should be >= 1/)).toBeInTheDocument())
    expect(screen.getByLabelText('Mention spike min count')).toHaveValue(9)
  })
})
