import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { formatDateTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAnalysis } from './hooks'
import type { AnalysisLean } from '@/types/api'

const LEAN_META: Record<AnalysisLean, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}

export function AnalysisTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useAnalysis(ticker)

  if (isPending) return <Skeleton className="h-72 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize',
            LEAN_META[data.lean],
          )}
        >
          {data.lean}
        </span>
        <span className="text-muted-foreground text-sm">
          Overall score {formatScore(data.overall_score)} · generated {formatDateTime(data.generated_at)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.components.map((component) => (
          <Card key={component.name}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{component.name}</CardTitle>
              <span className="text-sm font-medium tabular-nums">
                {formatScore(component.score)}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{component.explanation}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.caveats.length > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          {data.caveats.map((caveat, i) => (
            <p key={i}>⚠ {caveat}</p>
          ))}
        </div>
      )}
    </div>
  )
}
