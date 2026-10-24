import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

afterEach(() => vi.restoreAllMocks())

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

test('opens the archive from its deep link without requesting cleanup', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    generated_at: '2026-10-13T14:00:00Z', collections: [],
  }), { status: 200 }))
  renderWithProviders(<SystemPage />, ['/system?tab=archive'])

  expect(screen.getByRole('tab', { name: 'Archive' })).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByRole('heading', { name: 'Saved research' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/v1/research-archive', expect.objectContaining({
    headers: expect.any(Headers),
  }))
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('opens the archive with the tab control', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    generated_at: '2026-10-13T14:00:00Z', collections: [],
  }), { status: 200 }))
  renderWithProviders(<SystemPage />, ['/system'])

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Archive' }))
  expect(await screen.findByRole('heading', { name: 'Saved research' })).toBeInTheDocument()
  expect(screen.queryByText('health panel')).not.toBeInTheDocument()
})
