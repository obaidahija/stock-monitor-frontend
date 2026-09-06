import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AiResearchTab } from './ai-research-tab'

const hooks = vi.hoisted(() => ({
  useAiResearch: vi.fn(),
  useRefreshAiResearch: vi.fn(),
  useGoogleFinanceResearch: vi.fn(),
}))

vi.mock('../hooks', () => hooks)

beforeEach(() => {
  hooks.useAiResearch.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: false,
  })
  hooks.useRefreshAiResearch.mockReturnValue({
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    isError: false,
  })
  hooks.useGoogleFinanceResearch.mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    error: null,
    isError: false,
    isPending: false,
  })
})

afterEach(cleanup)

test('renders the structured report above the Google Finance card', () => {
  renderWithProviders(<AiResearchTab ticker="MSTR" />)

  const googleCard = screen.getByText('Google Finance Research')
  const reportHeading = screen.getByRole('heading', { name: 'MarketScout Structured Report' })

  expect(
    reportHeading.compareDocumentPosition(googleCard) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ask Google Finance' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Generate AI research/ })).toBeInTheDocument()
})
