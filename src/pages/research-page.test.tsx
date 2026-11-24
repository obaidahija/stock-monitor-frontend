import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ResearchPage } from './research-page'

function stub(name: string) {
  return () => <div data-testid="research-section">{name}</div>
}

vi.mock('@/features/research-first/research-first-panel', () => ({ DiscoverResearchFirst: stub('research-first') }))
vi.mock('@/features/discover/fresh-catalysts-section', () => ({ FreshCatalystsSection: stub('fresh-catalysts') }))

afterEach(cleanup)

test('shows Research First then Fresh Catalysts', () => {
  renderWithProviders(<ResearchPage />)

  expect(screen.getByRole('heading', { level: 1, name: 'Research' })).toBeInTheDocument()
  const order = screen.getAllByTestId('research-section').map((node) => node.textContent)
  expect(order).toEqual(['research-first', 'fresh-catalysts'])
})

test('no longer shows the removed earnings release monitor', () => {
  renderWithProviders(<ResearchPage />)
  expect(screen.queryByRole('heading', { name: 'Earnings release monitor' })).not.toBeInTheDocument()
})
