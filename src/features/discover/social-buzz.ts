import type { CSSProperties } from 'react'

// Reddit's own brand orange and Twitter/X's classic blue — an adjacent pair
// from the shared data-viz categorical palette, validated CVD-safe together
// (worst adjacent deltaE 9.1 light / 8.4 dark). Doubles as a mnemonic: the
// color already says which platform without reading the legend. Shared by
// every view that blends both platforms' attention signal into one ranking
// (Discover's Social Buzz strip, Trending's Hot strip and leaderboard) --
// each platform's own page (Twitter, Reddit) shows only its own signal and
// doesn't need these.
export const REDDIT_BAR = 'bg-[#eb6834] dark:bg-[#d95926]'
export const REDDIT_DOT = 'bg-[#eb6834] dark:bg-[#d95926]'
export const TWITTER_BAR = 'bg-[#2a78d6] dark:bg-[#3987e5]'
export const TWITTER_DOT = 'bg-[#2a78d6] dark:bg-[#3987e5]'
export const BOTH_GRADIENT = 'linear-gradient(to bottom, #eb6834, #2a78d6)'

// Rank reads through background tint alone -- no bar length needed once a
// per-ticker list becomes a single scrollable strip. Shared by every
// two-tone-accent strip (Social Buzz, Trending's Hot strip).
export function weightClassFor(index: number, total: number): string {
  const pct = total <= 1 ? 0 : index / (total - 1)
  if (pct < 0.12) return 'bg-primary/15 ring-primary/30'
  if (pct < 0.35) return 'bg-primary/10 ring-primary/20'
  if (pct < 0.65) return 'bg-primary/5 ring-primary/10'
  return 'bg-card ring-foreground/10'
}

// The left edge is the platform legend: solid Reddit orange or Twitter blue for a
// ticker seen on one platform, a two-tone split for a ticker trending on *both* --
// so double coverage reads at a glance, as its own color, without a badge or label.
export function accentStyleFor(hasReddit: boolean, hasTwitter: boolean): CSSProperties {
  if (hasReddit && hasTwitter) {
    return { background: BOTH_GRADIENT }
  }
  return { background: hasReddit ? '#eb6834' : '#2a78d6' }
}

export function coverageLabel(hasReddit: boolean, hasTwitter: boolean): string {
  if (hasReddit && hasTwitter) return 'Reddit + Twitter'
  return hasReddit ? 'Reddit only' : 'Twitter only'
}

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
