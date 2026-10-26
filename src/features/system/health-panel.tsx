import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { StatusPill } from '@/components/shared/status-pill'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SourceHealthOut, SourceHealthState } from '@/types/api'
import { useHealth } from './hooks'

const STATE_STYLES: Record<SourceHealthState, { dot: string; text: string }> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-foreground' },
  partial: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  failed: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  unknown: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
}

function StateBadge({ state }: { state: SourceHealthState }) {
  const style = STATE_STYLES[state]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
      <span className={style.text}>{state}</span>
    </span>
  )
}

/** The server-measured age of the last successful fetch, e.g. "2 hours ago". */
function formatAge(seconds: number): string {
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (seconds >= size) {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        -Math.round(seconds / size),
        unit,
      )
    }
  }
  return 'just now'
}

function SourceRow({ source }: { source: SourceHealthOut }) {
  // A backend that predates provider states only knows ok/error.
  if (!source.state) {
    return (
      <div
        role="group"
        aria-label={source.name}
        className="border-border flex items-center justify-between rounded-lg border px-3 py-2"
      >
        <div>
          <p className="text-sm font-medium capitalize">{source.name}</p>
          <p className="text-muted-foreground text-xs">
            {source.error ?? `Last fetched ${formatRelativeTime(source.fetched_at)}`}
          </p>
        </div>
        <StatusPill ok={source.ok} label={source.ok ? 'ok' : 'error'} />
      </div>
    )
  }

  const lastSuccess =
    source.age_seconds != null
      ? `Last success ${formatAge(source.age_seconds)}`
      : source.fetched_at
        ? `Last success ${formatRelativeTime(source.fetched_at)}`
        : 'No successful fetch yet'
  return (
    <div
      role="group"
      aria-label={source.name}
      className="border-border flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium capitalize">{source.name}</p>
        {source.state === 'unknown' ? (
          <p className="text-muted-foreground text-xs">No fetch attempt recorded yet</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">{lastSuccess}</p>
            {source.attempted != null && (
              <p className="text-muted-foreground text-xs">
                Latest attempt: {source.succeeded} of {source.attempted} {source.count_unit}{' '}
                succeeded{source.producer ? ` (${source.producer})` : ''}
              </p>
            )}
            {source.state !== 'healthy' && source.error && (
              <p className="text-xs break-words text-red-600 dark:text-red-400">{source.error}</p>
            )}
          </>
        )}
      </div>
      <StateBadge state={source.state} />
    </div>
  )
}

export function HealthPanel() {
  const { data, isPending, isError, error, refetch } = useHealth()

  if (isPending) return <Skeleton className="h-32 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>System health</CardTitle>
        <StatusPill
          ok={data.status === 'ok' && data.scheduler_running}
          label={data.scheduler_running ? data.status : 'scheduler stopped'}
        />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {data.sources.map((source) => (
          <SourceRow key={source.name} source={source} />
        ))}
      </CardContent>
    </Card>
  )
}
