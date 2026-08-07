import { cn } from '@/lib/utils'

const TIER_META: Record<number, { label: string; className: string }> = {
  1: { label: 'Filing', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  2: { label: 'Earnings', className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  3: { label: 'Sentiment', className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  4: { label: 'News volume', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  5: { label: 'Watchlist', className: 'bg-muted text-muted-foreground' },
}

export function TierBadge({ tier }: { tier: number }) {
  const meta = TIER_META[tier] ?? { label: `Tier ${tier}`, className: 'bg-muted text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}
