import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleMinus,
  RefreshCw,
  Shuffle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { InsightFactorOut, InsightSignal, InsightSummaryOut } from '@/types/insight-summary'

interface InsightSummaryCardProps {
  title: string
  summary: InsightSummaryOut | null
  isRefreshing: boolean
  refreshError: unknown
  onRefresh: () => void
}

const SIGNAL_STYLES: Record<InsightSignal, string> = {
  positive:
    'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  negative: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  neutral: 'border-border bg-muted text-muted-foreground',
  mixed: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

function SignalIcon({ signal }: { signal: InsightSignal }) {
  const className = 'size-3.5'
  if (signal === 'positive') return <ArrowUpRight className={className} />
  if (signal === 'negative') return <ArrowDownRight className={className} />
  if (signal === 'mixed') return <Shuffle className={className} />
  return <CircleMinus className={className} />
}

function SignalBadge({ signal }: { signal: InsightSignal | null }) {
  if (signal === null) {
    return <Badge variant="outline">Unavailable</Badge>
  }
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', SIGNAL_STYLES[signal])}
      aria-label={`Business impact: ${signal}`}
    >
      <SignalIcon signal={signal} />
      {signal}
    </Badge>
  )
}

function errorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  return 'Refresh failed. Try again.'
}

function Factor({ factor }: { factor: InsightFactorOut }) {
  return (
    <li className="flex gap-2.5 rounded-lg border bg-muted/25 p-3">
      <span
        className={cn(
          'mt-1 size-2 shrink-0 rounded-full',
          factor.polarity === 'positive' && 'bg-emerald-500',
          factor.polarity === 'negative' && 'bg-rose-500',
          factor.polarity === 'neutral' && 'bg-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium leading-snug">{factor.title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{factor.detail}</span>
      </span>
    </li>
  )
}

export function InsightSummaryCard({
  title,
  summary,
  isRefreshing,
  refreshError,
  onRefresh,
}: InsightSummaryCardProps) {
  const factors = summary
    ? [...summary.key_negatives, ...summary.key_positives, ...summary.key_neutral].slice(0, 3)
    : []
  const message = errorMessage(refreshError)

  return (
    <Card className="border-foreground/10 shadow-sm">
      <CardHeader className="border-b bg-muted/15">
        <CardTitle>{title}</CardTitle>
        <CardDescription>Decision-ready summary from verified source evidence.</CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing analysis' : 'Refresh analysis'}
            onClick={onRefresh}
          >
            {isRefreshing ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {message ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Refresh did not finish</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {summary?.stale ? (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Saved result may be out of date</AlertTitle>
            <AlertDescription>Refresh when you are ready to check the latest sources.</AlertDescription>
          </Alert>
        ) : null}

        {!summary ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-6 text-center">
            <p className="font-medium">No saved summary</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Refresh analysis to create a short, evidence-backed result.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SignalBadge signal={summary.signal} />
              {summary.confidence ? (
                <span className="text-xs font-medium capitalize text-muted-foreground">
                  {summary.confidence} confidence
                </span>
              ) : null}
              {summary.status === 'partial' ? <Badge variant="outline">Partial coverage</Badge> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-semibold tracking-tight">{summary.headline}</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {summary.explanation}
              </p>
            </div>

            {factors.length ? (
              <ul className="grid gap-2 md:grid-cols-3">
                {factors.map((factor) => <Factor key={factor.id} factor={factor} />)}
              </ul>
            ) : null}

            {summary.key_facts.length ? (
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summary.key_facts.map((fact) => (
                  <div key={`${fact.label}:${fact.value}`} className="rounded-lg bg-muted/40 px-3 py-2.5">
                    <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">{fact.value}</dd>
                    {fact.context ? (
                      <dd className="mt-0.5 text-xs text-muted-foreground">{fact.context}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            ) : null}

            {summary.coverage.excluded.length ? (
              <p className="text-xs text-muted-foreground">
                Not covered: {summary.coverage.excluded.join(', ')}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Business impact, not a buy/sell recommendation.
      </CardFooter>
    </Card>
  )
}
