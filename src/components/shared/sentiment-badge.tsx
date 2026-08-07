import { cn } from '@/lib/utils'
import { formatScore } from '@/lib/format'

const SENTIMENT_META: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

export function SentimentBadge({
  label,
  score,
}: {
  label: string | null
  score?: number | null
}) {
  if (!label) return <span className="text-muted-foreground text-xs">—</span>
  const className = SENTIMENT_META[label] ?? SENTIMENT_META.neutral
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap',
        className,
      )}
    >
      {label}
      {score !== undefined && score !== null && (
        <span className="opacity-70">{formatScore(score)}</span>
      )}
    </span>
  )
}
