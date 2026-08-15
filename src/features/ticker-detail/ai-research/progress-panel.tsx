import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useAiResearchProgress } from './use-ai-research-progress'

export function ProgressPanel({ ticker, active }: { ticker: string; active: boolean }) {
  const event = useAiResearchProgress(ticker, active)
  if (!active || !event) return null

  const isFailed = event.status === 'failed'
  const pct = event.total > 0 ? Math.round((event.processed / event.total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <Progress
        value={pct}
        className={cn('h-1.5', isFailed && '[&>div]:bg-red-500')}
      />
      <p
        className={cn(
          'text-muted-foreground text-xs',
          isFailed && 'text-red-600 dark:text-red-400',
        )}
      >
        {isFailed
          ? `Failed${event.message ? ` — ${event.message}` : ''}`
          : `Stage ${event.processed}/${event.total} (${pct}%)${
              event.message ? ` — ${event.message}` : ''
            }`}
      </p>
    </div>
  )
}
