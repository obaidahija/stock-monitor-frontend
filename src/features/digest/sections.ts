import {
  ArrowUpDown,
  BarChart3,
  CalendarClock,
  FileText,
  Files,
  Flame,
  History,
  MessageSquare,
  Minus,
  Newspaper,
  Star,
  Sunrise,
  TrendingDown,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { DigestItem } from '@/types/api'

export interface SectionMeta {
  label: string
  icon: LucideIcon
}

// Keyed by the section name digest_service._build_item assigns. Sections are
// rendered in payload order, which the backend already ranked, so no tier
// numbering lives here -- the numbered map this replaced drifted from the
// backend twice and shifted every label below the gap.
export const SECTION_META: Record<string, SectionMeta> = {
  filing: { label: 'Filing', icon: FileText },
  earnings: { label: 'Earnings', icon: CalendarClock },
  premarket_gap: { label: 'Premarket gap', icon: Sunrise },
  unusual_volume: { label: 'Unusual volume', icon: BarChart3 },
  insider_buy: { label: 'Insider buying', icon: Users },
  mention_spike: { label: 'Mention spike', icon: Flame },
  pattern_extreme: { label: 'Pattern near 12-week low/high', icon: ArrowUpDown },
  recent_bullish_pattern: { label: 'Recent bullish pattern', icon: History },
  near_low: { label: 'Near 12-week low', icon: TrendingDown },
  news_volume: { label: 'News volume', icon: Newspaper },
  score_extreme: { label: 'Score leaders & laggards', icon: Star },
  // Routine 8-Ks (Reg FD, generic officer changes, unverified item codes):
  // still covered, never part of the compact view.
  other_filings: { label: 'Other filings', icon: Files },
  // Sections that only exist on digests stored before items carried a name.
  insider_cluster_buy: { label: 'Insider cluster buy', icon: Users },
  strong_sentiment: { label: 'Strong sentiment', icon: MessageSquare },
}

// The tier numbers digests used before items carried a section name.
const LEGACY_TIER_SECTIONS: Record<number, string> = {
  1: 'filing',
  2: 'earnings',
  3: 'insider_cluster_buy',
  4: 'pattern_extreme',
  5: 'recent_bullish_pattern',
  6: 'near_low',
  7: 'strong_sentiment',
  8: 'premarket_gap',
  9: 'unusual_volume',
  10: 'mention_spike',
  11: 'news_volume',
  12: 'score_extreme',
}

export function sectionOf(item: DigestItem): string {
  return item.section ?? LEGACY_TIER_SECTIONS[item.tier] ?? 'other'
}

export function sectionMeta(section: string): SectionMeta {
  return SECTION_META[section] ?? { label: 'Other', icon: Minus }
}
