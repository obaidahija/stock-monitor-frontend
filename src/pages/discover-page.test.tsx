import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { DiscoverPage } from './discover-page'

function stub(name: string) {
  return () => <div data-testid="discover-section">{name}</div>
}

vi.mock('@/features/research-first/research-first-panel', () => ({ DiscoverResearchFirst: stub('research-first') }))
vi.mock('@/features/discover/fresh-catalysts-section', () => ({ FreshCatalystsSection: stub('fresh-catalysts') }))
vi.mock('@/features/discover/short-squeeze-section', () => ({ ShortSqueezeSection: stub('short-squeeze') }))
vi.mock('@/features/discover/upcoming-macro-events', () => ({ UpcomingMacroEvents: stub('macro-events') }))
vi.mock('@/features/discover/macro-attention-strip', () => ({ MacroAttentionStrip: stub('macro-attention') }))
vi.mock('@/features/discover/social-buzz-strip', () => ({ SocialBuzzStrip: stub('social-buzz') }))
vi.mock('@/features/discover/price-target-changes-strip', () => ({ PriceTargetChangesStrip: stub('price-targets') }))
vi.mock('@/features/google-finance-outlook/google-finance-outlook-section', () => ({ GoogleFinanceOutlookSection: stub('outlook') }))
vi.mock('@/features/discover/sector-heatmap', () => ({ SectorHeatmap: stub('sector-heatmap') }))
vi.mock('@/features/discover/universe-table', () => ({ UniverseTable: stub('universe-table') }))
vi.mock('@/features/discover/notable-filings-section', () => ({ NotableFilingsSection: stub('notable-filings') }))

afterEach(cleanup)

test('shows research priorities and catalysts alongside market discovery', () => {
  render(<DiscoverPage />)
  const order = screen.getAllByTestId('discover-section').map((node) => node.textContent)
  expect(order).toEqual([
    'research-first', 'macro-events', 'macro-attention', 'social-buzz',
    'price-targets', 'outlook', 'fresh-catalysts', 'sector-heatmap', 'universe-table',
  ])
})
