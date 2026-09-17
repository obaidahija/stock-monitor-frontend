import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TickerDetailPage } from './ticker-detail-page'

vi.mock('@/components/shared/page-header', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => <header>{title}</header>,
}))
vi.mock('@/features/discover/add-tracked-ticker-button', () => ({
  AddTrackedTickerButton: () => null,
}))
vi.mock('@/features/discover/remove-ticker-dialog', () => ({ RemoveTickerDialog: () => null }))
vi.mock('@/features/watchlists/manage-lists-dialog', () => ({ ManageListsDialog: () => null }))
vi.mock('@/features/ticker-detail/price-chart', () => ({ PriceChart: () => null }))
vi.mock('@/features/ticker-detail/ticker-price-header', () => ({ TickerPriceHeader: () => null }))
vi.mock('@/features/ticker-detail/ai-research/ai-research-tab', () => ({
  AiResearchTab: () => <div>AI research content</div>,
}))
vi.mock('@/features/ticker-detail/analysis-tab', () => ({
  AnalysisTab: () => <div>Analysis content</div>,
}))
vi.mock('@/features/ticker-detail/competitors/competitors-tab', () => ({
  CompetitorsTab: () => null,
}))
vi.mock('@/features/ticker-detail/earnings-tab', () => ({ EarningsTab: () => null }))
vi.mock('@/features/ticker-detail/news-tab', () => ({ NewsTab: () => null }))
vi.mock('@/features/ticker-detail/filings-tab', () => ({ FilingsTab: () => null }))
vi.mock('@/features/ticker-detail/insider-tab', () => ({ InsiderTab: () => null }))
vi.mock('@/features/ticker-detail/twitter-tab', () => ({ TwitterTab: () => null }))
vi.mock('@/features/ticker-detail/reddit-tab', () => ({ RedditTab: () => null }))
vi.mock('@/features/ticker-detail/catalysts-tab', () => ({
  CatalystsTab: () => <div>Catalysts content</div>,
}))
vi.mock('@/features/ticker-detail/hooks', () => ({
  useAutoRefreshQuote: vi.fn(),
  useAutoRefreshUniverseScore: vi.fn(),
  useUniverseScore: () => ({ data: null, isPending: false }),
}))

afterEach(cleanup)

test('renders every detail tab', () => {
  renderWithProviders(<TickerDetailPage />, ['/stocks/NVDA'])

  expect(screen.getByRole('tab', { name: 'Earnings' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'News' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Filings' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Catalysts' })).toBeInTheDocument()
})

test('opens the Catalysts tab from a deep link', () => {
  renderWithProviders(<TickerDetailPage />, ['/stocks/NVDA?tab=catalysts'])

  expect(screen.getByText('Catalysts content')).toBeInTheDocument()
})

test('falls back to Analysis for an unknown tab', () => {
  renderWithProviders(<TickerDetailPage />, ['/stocks/NVDA?tab=nonsense'])

  expect(screen.getByText('Analysis content')).toBeInTheDocument()
})
