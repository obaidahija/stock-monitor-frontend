import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { SectorHeatmap } from './sector-heatmap'
import { universeRow } from './universe-table.test-helpers'

const energy = {
  sector: 'Energy',
  avg_change_pct: 0.9,
  count: 2,
  advancers: 2,
  decliners: 0,
  top_ticker: 'CCJ',
  top_ticker_change_pct: 1.5,
  industries: [
    { industry: 'Uranium', avg_change_pct: 1.5, count: 1, advancers: 1, decliners: 0, top_ticker: 'CCJ', top_ticker_change_pct: 1.5 },
    { industry: 'Oil & Gas E&P', avg_change_pct: 0.3, count: 1, advancers: 1, decliners: 0, top_ticker: 'APA', top_ticker_change_pct: 0.3 },
  ],
}

vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useSectorHeatmap: () => ({
    data: { items: [energy], total_tickers: 2, unclassified_tickers: 0 },
    isPending: false,
    isError: false,
  }),
  useSectorTickers: (sector: string | null) => ({
    data: sector
      ? {
          items: [
            universeRow({ ticker: 'CCJ', sector: 'Energy', industry: 'Uranium', change_pct: 1.5 }),
            universeRow({ ticker: 'APA', sector: 'Energy', industry: 'Oil & Gas E&P', change_pct: 0.3 }),
          ],
          total: 2,
        }
      : undefined,
    isPending: false,
  }),
}))

beforeAll(() => {
  // jsdom has no layout; give the map a width so the treemap lays out.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 })
})

afterEach(cleanup)

test('dives into a sector and an industry, then zooms back out', async () => {
  renderWithProviders(<SectorHeatmap />)
  const nav = screen.getByRole('navigation', { name: 'Sector map zoom' })
  expect(within(nav).queryByRole('button', { name: /Zoom out/ })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Zoom into Energy' }))
  expect(within(nav).getByText('Energy')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zoom into Uranium' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Zoom into Uranium' }))
  expect(within(nav).getByText('Uranium')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^CCJ/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^APA/ })).not.toBeInTheDocument()

  await userEvent.click(within(nav).getByRole('button', { name: /Zoom out/ }))
  await userEvent.click(within(nav).getByRole('button', { name: /Zoom out/ }))
  expect(within(nav).queryByRole('button', { name: /Zoom out/ })).not.toBeInTheDocument()
})
