import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ResearchPage } from './research-page'

function stub(name: string) {
  return () => <div data-testid="research-section">{name}</div>
}

vi.mock('@/features/research-first/research-first-panel', () => ({ DiscoverResearchFirst: stub('research-first') }))
vi.mock('@/features/discover/fresh-catalysts-section', () => ({ FreshCatalystsSection: stub('fresh-catalysts') }))
vi.mock('@/features/discover/short-squeeze-section', () => ({ ShortSqueezeSection: stub('short-squeeze') }))

afterEach(cleanup)

test('shows Research First, Fresh Catalysts and Short Squeeze, in that order', () => {
  render(<ResearchPage />)

  expect(screen.getByRole('heading', { level: 1, name: 'Research' })).toBeInTheDocument()
  const order = screen.getAllByTestId('research-section').map((node) => node.textContent)
  expect(order).toEqual(['research-first', 'fresh-catalysts', 'short-squeeze'])
})
