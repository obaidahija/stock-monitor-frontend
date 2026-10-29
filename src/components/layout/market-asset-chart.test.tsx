import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { MarketAssetChart } from './market-asset-chart'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: () => <div>Interactive chart</div>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null,
  XAxis: () => null, YAxis: () => null,
}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const asset = { symbol: 'GC=F', name: 'Gold', price: 4050, daily_change_pct: 1, quoted_at: null, status: 'ok' as const }

test('opens details by click, switches ranges and closes', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    symbol: 'GC=F', period: '1mo', points: [
      { date: '2026-10-27', open: 4000, high: 4100, low: 3990, close: 4050, volume: 12345 },
      { date: '2026-10-28', open: 4050, high: 4150, low: 4040, close: 4100, volume: 15000 },
    ],
  })
  const user = userEvent.setup()
  renderWithProviders(<MarketAssetChart asset={asset}><div>Gold quote</div></MarketAssetChart>)
  await screen.findByRole('img', { name: /one month/ })
  await user.click(screen.getByRole('button', { name: 'Explore Gold price history' }))
  expect(await screen.findByText('Period high')).toBeInTheDocument()
  expect(screen.getByText('$4,150.00')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '3M' }))
  expect(get).toHaveBeenLastCalledWith('/v1/market-assets/history?symbol=GC%3DF&period=3mo')
  await user.click(screen.getByRole('button', { name: 'Close price history' }))
  expect(screen.queryByText('Period high')).not.toBeInTheDocument()
})
