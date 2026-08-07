import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { StatusPill } from '@/components/shared/status-pill'
import { formatRelativeTime } from '@/lib/format'
import { useHealth } from './hooks'

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
          <div
            key={source.name}
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
        ))}
      </CardContent>
    </Card>
  )
}
