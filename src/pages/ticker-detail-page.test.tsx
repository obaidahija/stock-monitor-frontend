import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { currentLocation } from '@/test/location'
import { LocationProbe } from '@/test/location-probe'
import { renderWithProviders } from '@/test/render'
import { useUniverseScore } from '@/features/ticker-detail/hooks'
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
vi.mock('@/features/ticker-detail/price-target-change-banner', () => ({
  PriceTargetChangeBanner: () => null,
}))
vi.mock('@/features/ticker-detail/ticker-price-header', () => ({ TickerPriceHeader: () => null }))
vi.mock('@/features/ticker-detail/related-etfs', () => ({
  RelatedEtfs: ({ ticker }: { ticker: string }) => <div>Related ETFs for {ticker}</div>,
}))
vi.mock('@/features/ticker-detail/ticker-description', () => ({
  TickerDescription: ({ ticker }: { ticker: string }) => <div>About {ticker}</div>,
}))
vi.mock('@/features/ticker-detail/ticker-header-stats', () => ({ TickerHeaderStats: () => null }))
vi.mock('@/features/ticker-detail/ai-research/ai-research-tab', () => ({
  AiResearchTab: () => <div>AI research content</div>,
}))
vi.mock('@/features/ticker-detail/analysis-tab', () => ({
  AnalysisTab: () => <div>Analysis content</div>,
}))
vi.mock('@/features/ticker-detail/competitors/competitors-tab', () => ({
  CompetitorsTab: () => <div>Competitors content</div>,
}))
vi.mock('@/features/ticker-detail/pairs/pairs-tab', () => ({
  PairsTab: () => <div>Pairs content</div>,
}))
vi.mock('@/features/ticker-detail/earnings-tab', () => ({
  EarningsTab: () => <div>Earnings content</div>,
}))
vi.mock('@/features/ticker-detail/news-tab', () => ({ NewsTab: () => <div>News content</div> }))
vi.mock('@/features/ticker-detail/filings-tab', () => ({
  FilingsTab: () => <div>All filings content</div>,
}))
vi.mock('@/features/ticker-detail/insider-tab', () => ({
  InsiderTab: () => <div>Insider content</div>,
}))
vi.mock('@/features/ticker-detail/twitter-tab', () => ({
  TwitterTab: () => <div>Twitter content</div>,
}))
vi.mock('@/features/ticker-detail/reddit-tab', () => ({
  RedditTab: () => <div>Reddit content</div>,
}))
vi.mock('@/features/ticker-detail/hooks', () => ({
  useAutoRefreshQuote: vi.fn(),
  useAutoRefreshUniverseScore: vi.fn(),
  useUniverseScore: vi.fn(() => ({ data: null, isPending: false })),
}))

afterEach(() => {
  cleanup()
  vi.mocked(useUniverseScore).mockReturnValue({ data: null, isPending: false } as never)
})

function renderAt(path: string) {
  return renderWithProviders(
    <>
      <TickerDetailPage />
      <LocationProbe />
    </>,
    [path],
  )
}

test('shows seven tabs in reading order', () => {
  renderAt('/stocks/NVDA')

  const tabs = within(screen.getByRole('tablist', { name: 'Stock sections' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent)
  expect(tabs).toEqual(['Analysis', 'AI Research', 'News', 'Earnings', 'Social', 'Filings', 'Peers'])
})

test.each([
  ['catalysts', 'Earnings', 'Earnings content'],
  ['competitors', 'Peers', 'Competitors content'],
  ['pairs', 'Peers', 'Pairs content'],
  ['insider', 'Filings', 'Insider content'],
  ['twitter', 'Social', 'Twitter content'],
  ['reddit', 'Social', 'Reddit content'],
])('an old ?tab=%s link opens %s on the same content', (tab, tabName, content) => {
  renderAt(`/stocks/NVDA?tab=${tab}`)

  expect(screen.getByRole('tab', { name: tabName })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText(content)).toBeInTheDocument()
})

test('Filings opens on insider trades and links straight to all filings', () => {
  renderAt('/stocks/NVDA?tab=filings&view=all')

  expect(screen.getByText('All filings content')).toBeInTheDocument()
  expect(screen.queryByText('Insider content')).not.toBeInTheDocument()
})

test('switching the Peers view keeps it in the link', async () => {
  const user = userEvent.setup()
  renderAt('/stocks/NVDA?tab=peers')

  await user.click(screen.getByRole('tab', { name: 'Pairs' }))

  expect(screen.getByText('Pairs content')).toBeInTheDocument()
  expect(currentLocation()).toBe('/stocks/NVDA?tab=peers&view=pairs')
})

test('changing tab drops the old view but keeps the research window', async () => {
  const user = userEvent.setup()
  renderAt('/stocks/NVDA?tab=peers&view=pairs&horizon_sessions=3')

  await user.click(screen.getByRole('tab', { name: 'News' }))

  expect(screen.getByText('News content')).toBeInTheDocument()
  expect(currentLocation()).toBe('/stocks/NVDA?tab=news&horizon_sessions=3')
})

test('switching platform inside Social keeps the choice in the link', async () => {
  const user = userEvent.setup()
  renderAt('/stocks/NVDA?tab=social')

  await user.click(screen.getByRole('tab', { name: 'Reddit' }))

  expect(screen.getByText('Reddit content')).toBeInTheDocument()
  expect(currentLocation()).toBe('/stocks/NVDA?tab=social&platform=reddit')
})

test('falls back to Analysis for an unknown tab', () => {
  renderAt('/stocks/NVDA?tab=nonsense')

  expect(screen.getByText('Analysis content')).toBeInTheDocument()
})

test('names the company beside the symbol', () => {
  vi.mocked(useUniverseScore).mockReturnValue({
    data: { company_name: 'NVIDIA Corporation', industry: 'Semiconductors' },
    isPending: false,
  } as never)
  renderAt('/stocks/NVDA')

  expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
  expect(screen.getByText('Semiconductors')).toBeInTheDocument()
})

test('only an active Social tab on Twitter mounts the Twitter content', async () => {
  const user = userEvent.setup()
  renderAt('/stocks/NVDA?tab=news')
  expect(screen.getByText('News content')).toBeInTheDocument()
  expect(screen.queryByText('Twitter content')).not.toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Social' }))
  expect(screen.getByText('Twitter content')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Reddit' }))
  expect(screen.queryByText('Twitter content')).not.toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Analysis' }))
  expect(screen.queryByText('Twitter content')).not.toBeInTheDocument()
  expect(screen.queryByText('Reddit content')).not.toBeInTheDocument()
})
