import type { TrendingTickerOut } from '@/types/api'

/** Averages whichever platform sentiments a ticker actually has -- a ticker
 * seen on both platforms gets a true blend, one seen on only one just gets
 * that platform's reading. */
export function blendedTrendingSentiment(item: TrendingTickerOut): number | null {
  const scores = [item.twitter?.sentiment_score, item.reddit?.sentiment_score].filter(
    (score): score is number => score !== null && score !== undefined,
  )
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}
