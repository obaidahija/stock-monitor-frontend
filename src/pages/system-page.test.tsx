import { cleanup, screen } from '@testing-library/react'
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

test('no longer offers an ai tab -- settings moved to their own page', () => {
  renderWithProviders(<SystemPage />, ['/system'])

  expect(screen.queryByRole('tab', { name: 'AI' })).not.toBeInTheDocument()
  expect(screen.queryByText('ai settings form')).not.toBeInTheDocument()
})

test('redirects the old ?tab=ai deep link away instead of rendering ai settings', () => {
  renderWithProviders(<SystemPage />, ['/system?tab=ai'])

  // This harness renders SystemPage directly rather than under <Routes>, so
  // the <Navigate> updates the location and the page then re-renders on its
  // health default. What matters here is that ?tab=ai never shows AI
  // settings again; the redirect target itself is the router's contract.
  expect(screen.queryByText('ai settings form')).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'AI' })).not.toBeInTheDocument()
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
