import type { TrendingTickerOut } from '@/types/api'

/** Averages whichever platform sentiments a ticker actually has -- mirrors
 * discover/social-buzz.ts's blendedSentiment, adapted to TrendingTickerOut's
 * field names (twitter.sentiment_score / reddit.sentiment_score). */
export function blendedTrendingSentiment(item: TrendingTickerOut): number | null {
  const scores = [item.twitter?.sentiment_score, item.reddit?.sentiment_score].filter(
    (score): score is number => score !== null && score !== undefined,
  )
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}
