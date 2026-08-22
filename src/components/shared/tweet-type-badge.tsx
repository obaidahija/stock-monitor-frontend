import { cn } from '@/lib/utils'

const TWEET_TYPE_META: Record<string, string> = {
  news: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  recommendation: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  analysis: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  other: 'bg-muted text-muted-foreground',
}

export function TweetTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const className = TWEET_TYPE_META[type] ?? TWEET_TYPE_META.other
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap',
        className,
      )}
    >
      {type}
    </span>
  )
}
