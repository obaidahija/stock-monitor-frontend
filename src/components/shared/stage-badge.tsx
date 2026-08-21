import {
  BarChart3,
  CalendarClock,
  FileText,
  History,
  Star,
  Sunrise,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Every digest-selection stage a ticker can qualify under (digest_service.py
// build_digest) — a ticker can carry several at once, which is the point of
// the mixed-signal system.
export const STAGE_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  score_leader: {
    label: 'Score leader',
    icon: Star,
    className: 'bg-muted text-muted-foreground',
  },
  premarket_gap: {
    label: 'Premarket gap',
    icon: Sunrise,
    className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
  unusual_volume: {
    label: 'Unusual volume',
    icon: BarChart3,
    className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  near_low: {
    label: 'Near 12wk low',
    icon: TrendingDown,
    className: 'border border-cyan-500/40 text-cyan-600 dark:text-cyan-400',
  },
  bullish_pattern: {
    label: 'Bullish pattern',
    icon: TrendingUp,
    className: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold',
  },
  recent_bullish_pattern: {
    label: 'Recent pattern',
    icon: History,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold',
  },
  filing: {
    label: 'Filing',
    icon: FileText,
    className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
  earnings: {
    label: 'Earnings',
    icon: CalendarClock,
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  },
}

export function StageBadge({ stage }: { stage: string }) {
  const meta = STAGE_META[stage]
  if (!meta) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
        meta.className,
      )}
    >
      <meta.icon className="size-3" />
      {meta.label}
    </span>
  )
}
