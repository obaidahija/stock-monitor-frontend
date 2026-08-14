import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useJobProgress } from './use-job-progress'

export function JobProgressBar({ jobName }: { jobName: string }) {
  const event = useJobProgress(jobName)
  if (!event) return null

  const isFailed = event.status === 'failed'
  const isCompleted = event.status === 'completed'
  const pct = event.total > 0 ? Math.round((event.processed / event.total) * 100) : 0

  return (
    <div className="flex items-center gap-3 py-1">
      <Progress
        value={isCompleted ? 100 : pct}
        className={cn(
          'h-1.5',
          isFailed && '[&>div]:bg-red-500',
          isCompleted && '[&>div]:bg-emerald-500',
        )}
      />
      <span
        className={cn(
          'text-muted-foreground shrink-0 text-xs whitespace-nowrap',
          isFailed && 'text-red-600 dark:text-red-400',
        )}
      >
        {isFailed
          ? `failed${event.message ? ` — ${event.message}` : ''}`
          : `${event.processed}/${event.total} scored${event.errors ? `, ${event.errors} errors` : ''}${
              !isCompleted && event.message ? ` — ${event.message}` : ''
            }`}
      </span>
    </div>
  )
}
