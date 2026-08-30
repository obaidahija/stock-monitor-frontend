import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SystemPage } from './system-page'

vi.mock('@/features/system/health-panel', () => ({
  HealthPanel: () => <div>health panel</div>,
}))
vi.mock('@/features/system/jobs-table', () => ({
  JobsTable: () => <div>jobs table</div>,
}))
vi.mock('@/features/ai-settings/ai-settings-form', () => ({
  AiSettingsForm: () => <div>ai settings form</div>,
}))

beforeEach(() => {
  cleanup()
})

test('shows health by default and keeps the tab out of the url', () => {
  renderWithProviders(<SystemPage />, ['/system'])

  expect(screen.getByText('health panel')).toBeInTheDocument()
  expect(screen.queryByText('jobs table')).not.toBeInTheDocument()
  expect(screen.queryByText('ai settings form')).not.toBeInTheDocument()
})

test('switches to the ai tab and reflects it in the url', async () => {
  const user = userEvent.setup()
  renderWithProviders(<SystemPage />, ['/system'])

  await user.click(screen.getByRole('tab', { name: 'AI' }))

  expect(screen.getByText('ai settings form')).toBeInTheDocument()
  expect(screen.queryByText('health panel')).not.toBeInTheDocument()
})

test('opens directly on the ai tab when the url requests it', () => {
  renderWithProviders(<SystemPage />, ['/system?tab=ai'])

  expect(screen.getByText('ai settings form')).toBeInTheDocument()
  expect(screen.queryByText('health panel')).not.toBeInTheDocument()
})

test('opens the jobs tab from the url', () => {
  renderWithProviders(<SystemPage />, ['/system?tab=jobs'])

  expect(screen.getByText('jobs table')).toBeInTheDocument()
  expect(screen.queryByText('health panel')).not.toBeInTheDocument()
})

test('falls back to health for an unknown tab', () => {
  renderWithProviders(<SystemPage />, ['/system?tab=nonsense'])

  expect(screen.getByText('health panel')).toBeInTheDocument()
})
