import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { currentLocation } from '@/test/location'
import { LocationProbe } from '@/test/location-probe'
import { renderWithProviders } from '@/test/render'
import type { TrendingTickerOut } from '@/types/api'
import { TrendingBuzzStrip } from './trending-buzz-strip'

function trendingTicker(
  ticker: string,
  ranks: { twitter: number | null; reddit: number | null },
): TrendingTickerOut {
  return {
    ticker,
    company_name: `${ticker} Inc.`,
    symbols: [{ ticker }],
    sector: 'Technology',
    price: 100,
    change_pct: 1.5,
    twitter:
      ranks.twitter === null
        ? null
        : {
            rank: ranks.twitter,
            unique_authors: 6,
            unique_posts: 8,
            representative_views: 12_000,
            sentiment_score: 0.2,
          },
    reddit:
      ranks.reddit === null
        ? null
        : {
            rank: ranks.reddit,
            mention_count: 5,
            unique_authors: 4,
            sentiment_score: 0.1,
            max_signal_score: 70,
          },
    combined_score: 0.5,
    appeared_days: 3,
    is_new_entrant: false,
    sparkline: [],
  }
}

afterEach(cleanup)

test.each([
  ['stronger on Twitter', trendingTicker('NVDA', { twitter: 1, reddit: 4 }), '/stocks/NVDA?tab=social'],
  ['ranked the same on both', trendingTicker('MU', { twitter: 2, reddit: 2 }), '/stocks/MU?tab=social'],
  ['only on Twitter', trendingTicker('AMD', { twitter: 2, reddit: null }), '/stocks/AMD?tab=social'],
  [
    'stronger on Reddit',
    trendingTicker('TSLA', { twitter: 9, reddit: 1 }),
    '/stocks/TSLA?tab=social&platform=reddit',
  ],
  [
    'only on Reddit',
    trendingTicker('GME', { twitter: null, reddit: 3 }),
    '/stocks/GME?tab=social&platform=reddit',
  ],
])('a ticker %s opens the stock page Social tab on that platform', async (_case, item, expected) => {
  const user = userEvent.setup()
  renderWithProviders(
    <>
      <TrendingBuzzStrip
        label="Social buzz"
        headerTooltip="Combined attention"
        items={[item]}
        onRefresh={() => {}}
        isRefreshing={false}
      />
      <LocationProbe />
    </>,
    ['/discover'],
  )

  await user.click(screen.getByRole('button', { name: `Open ${item.ticker}` }))

  expect(currentLocation()).toBe(expected)
})
