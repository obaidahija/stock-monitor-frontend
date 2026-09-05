import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useEarningsPlaybook } from './hooks'

function signedPct(value: number | null) {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function toneClass(value: number | null) {
  if (value === null || value === 0) return 'text-muted-foreground'
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

export function EarningsPlaybookCard({ ticker }: { ticker: string }) {
  const { data, isPending } = useEarningsPlaybook(ticker)

  if (isPending && !data) return <Skeleton className="h-48 rounded-xl" />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="text-muted-foreground size-4" />
          Earnings playbook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.reaction_quarters === 0 ? (
          <p className="text-muted-foreground text-sm">
            No usable earnings reactions yet — this needs both a cached price history and dated
            quarters that fall inside it.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-border rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-xs">Typical move on the day</p>
                <p className="text-xl font-semibold tabular-nums">
                  ±{data.reaction_mean_abs_pct?.toFixed(1)}%
                </p>
                <p className="text-muted-foreground text-xs">
                  across {data.reaction_quarters} quarters
                </p>
              </div>
              <div className="border-border rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-xs">Moved up</p>
                <p className="text-xl font-semibold tabular-nums">
                  {data.direction_consistency_pct?.toFixed(0)}%
                </p>
                <p className="text-muted-foreground text-xs">
                  {data.up_count} up / {data.down_count} down
                </p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Drift after the reaction
              </p>
              <div className="grid grid-cols-3 gap-2">
                {data.drift.map((entry) => (
                  <div
                    key={entry.horizon_days}
                    data-testid={`drift-${entry.horizon_days}`}
                    className="border-border rounded-lg border px-3 py-2"
                  >
                    <p className="text-muted-foreground text-xs">+{entry.horizon_days}d</p>
                    <p
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        toneClass(entry.mean_pct),
                      )}
                    >
                      {signedPct(entry.mean_pct)}
                    </p>
                    <p className="text-muted-foreground text-xs">{entry.quarters} qtrs</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        <p className="text-muted-foreground text-xs">
          Describes past reactions only — not a forecast. Each figure is labelled with the number of
          quarters behind it, which differs by horizon.
        </p>
      </CardContent>
    </Card>
  )
}
