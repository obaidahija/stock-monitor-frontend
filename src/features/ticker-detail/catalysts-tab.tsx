import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatDate } from '@/lib/format'
import { useCatalysts } from './hooks'

export function CatalystsTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useCatalysts(ticker)

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data || data.length === 0) return <EmptyState title="No upcoming catalysts" />

  return (
    <div className="space-y-2">
      {data.map((catalyst, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <span className="text-sm font-medium capitalize">
              {catalyst.catalyst_type.replace(/_/g, ' ')}
            </span>
            <span className="text-muted-foreground text-sm">{formatDate(catalyst.event_date)}</span>
          </CardHeader>
          {catalyst.description && (
            <CardContent>
              <p className="text-muted-foreground text-sm">{catalyst.description}</p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
