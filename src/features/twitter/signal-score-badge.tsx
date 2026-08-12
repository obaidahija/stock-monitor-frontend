import { cn } from '@/lib/utils'

function scoreClassName(score: number): string {
  if (score >= 70) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (score >= 40) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-muted text-muted-foreground'
}

export function SignalScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground text-xs">Not scored</span>
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap',
        scoreClassName(score),
      )}
    >
      {score.toFixed(0)}
    </span>
  )
}
