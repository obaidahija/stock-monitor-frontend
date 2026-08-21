import {
  BarChart3,
  CalendarClock,
  FileText,
  History,
  MessageSquare,
  Minus,
  Newspaper,
  Sunrise,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mirrors the backend's 10-tier ranking in digest_service._sort_key (filing >
// earnings-soon > bullish-pattern (near-low ranked) > bullish-pattern
// (recency ranked) > near-12wk-low > strong sentiment > premarket gap >
// unusual volume > news volume > nothing notable).
export const DIGEST_TIER_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export const TIER_META: Record<number, { label: string; icon: LucideIcon; className: string }> = {
  1: { label: 'Filing', icon: FileText, className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  2: {
    label: 'Earnings soon',
    icon: CalendarClock,
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  },
  3: {
    label: 'Bullish pattern',
    icon: TrendingUp,
    className: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  },
  4: {
    label: 'Recent bullish pattern',
    icon: History,
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  5: {
    label: 'Near 12-week low',
    icon: TrendingDown,
    className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  },
  6: {
    label: 'Strong sentiment',
    icon: MessageSquare,
    className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  7: { label: 'Premarket gap', icon: Sunrise, className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  8: {
    label: 'Unusual volume',
    icon: BarChart3,
    className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  9: { label: 'News volume', icon: Newspaper, className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  10: { label: 'Tracked', icon: Minus, className: 'bg-muted text-muted-foreground' },
}

export function TierBadge({ tier }: { tier: number }) {
  const meta = TIER_META[tier] ?? {
    label: `Tier ${tier}`,
    icon: Minus,
    className: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      <meta.icon className="size-3" />
      {meta.label}
    </span>
  )
}
