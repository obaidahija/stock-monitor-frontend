import type { TrendingSocialOut, TwitterBestStockOut } from '@/types/api'

// Reddit's own brand orange and Twitter/X's classic blue — an adjacent pair
// from the shared data-viz categorical palette, validated CVD-safe together
// (worst adjacent deltaE 9.1 light / 8.4 dark). Doubles as a mnemonic: the
// color already says which platform without reading the legend. Shared by
// every view that blends the two platforms' attention signal (Discover's
// Social Buzz list, Twitter's Top Mentions strip) so the color always means
// the same thing.
export const REDDIT_BAR = 'bg-[#eb6834] dark:bg-[#d95926]'
export const REDDIT_DOT = 'bg-[#eb6834] dark:bg-[#d95926]'
export const TWITTER_BAR = 'bg-[#2a78d6] dark:bg-[#3987e5]'
export const TWITTER_DOT = 'bg-[#2a78d6] dark:bg-[#3987e5]'

export const TONE_TEXT: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
}

export function toneOf(score: number | null): 'positive' | 'negative' | 'neutral' {
  if (score === null || score === 0) return 'neutral'
  return score > 0 ? 'positive' : 'negative'
}

export type PlatformFilter = 'all' | 'reddit' | 'twitter'

export interface MergedSocialBuzzRow {
  ticker: string
  companyName: string | null
  reddit: { score: number; mentions: number | null; sentiment: number | null } | null
  twitter: {
    score: number
    authors: number
    posts: number
    views: number
    sentiment: number | null
    symbols: TwitterBestStockOut['symbols']
  } | null
  combinedScore: number
}

/** Blends the two independently-fetched leaderboards into one ranking: each
 * ticker's Reddit buzz score (already 0-100) and Twitter author count
 * (normalized 0-100 against this list's max) are summed into one combined
 * attention score, so a ticker trending on both platforms naturally
 * outranks one trending on only one. */
export function mergeSocialBuzz(
  redditItems: TrendingSocialOut[],
  twitterItems: TwitterBestStockOut[],
): MergedSocialBuzzRow[] {
  const maxAuthors = Math.max(1, ...twitterItems.map((item) => item.unique_authors))
  const rows = new Map<string, MergedSocialBuzzRow>()

  for (const item of redditItems) {
    if (item.buzz_score === null) continue
    rows.set(item.ticker, {
      ticker: item.ticker,
      companyName: null,
      reddit: { score: item.buzz_score, mentions: item.mentions, sentiment: item.sentiment_score },
      twitter: null,
      combinedScore: item.buzz_score,
    })
  }

  for (const item of twitterItems) {
    const score = (item.unique_authors / maxAuthors) * 100
    const twitter = {
      score,
      authors: item.unique_authors,
      posts: item.unique_posts,
      views: item.representative_views,
      sentiment: item.sentiment_score,
      symbols: item.symbols,
    }
    const existing = rows.get(item.ticker)
    if (existing) {
      existing.twitter = twitter
      existing.companyName = item.company_name
      existing.combinedScore += score
    } else {
      rows.set(item.ticker, {
        ticker: item.ticker,
        companyName: item.company_name,
        reddit: null,
        twitter,
        combinedScore: score,
      })
    }
  }

  return [...rows.values()].sort((a, b) => b.combinedScore - a.combinedScore)
}

// Each row's headline score/rank depends on which platform is selected —
// combined attention for "all", but the platform's own (unnormalized-feel)
// score when narrowed to just one source, so "Reddit only" reads as a
// genuine Reddit ranking rather than a combined score with an empty half.
export function scoreFor(row: MergedSocialBuzzRow, filter: PlatformFilter): number {
  if (filter === 'reddit') return row.reddit?.score ?? 0
  if (filter === 'twitter') return row.twitter?.score ?? 0
  return row.combinedScore
}
