import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { RefreshCw, Search } from 'lucide-react'
import { pairTicker } from '@/api/stock-pairs'
import { MessageResponse } from '@/components/ai-elements/message'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import type {
  StockPairEvidenceStatus,
  StockPairItemOut,
  StockPairsOut,
  StockPairStrength,
} from '@/types/api'
import { useRefreshStockPairs, useStockPairs } from './hooks'
import { PairBacktestPanel } from './pair-backtest-panel'
import { PairBusinessEvidence } from './pair-business-evidence'
import { PairCorrelations, PairMetrics, type PairWindow } from './pair-metrics'
import { rankPairItems } from './pair-ranking'
import { PairScatterPlot } from './pair-scatter-plot'
import { PairStrategyPanel } from './pair-strategy-panel'

const WINDOWS: { value: PairWindow; label: string }[] = [
  { value: 'six_month', label: '6 months (~126 sessions)' },
  { value: 'three_month', label: '3 months (~63 sessions)' },
]

const WINDOW_NAMES: Record<PairWindow, string> = {
  six_month: '6-month',
  three_month: '3-month',
}

const STRENGTH: Record<StockPairStrength, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  strong: { label: 'Strong', variant: 'default' },
  moderate: { label: 'Moderate', variant: 'secondary' },
  not_confirmed: { label: 'Not confirmed', variant: 'outline' },
}

// "computed" needs no label: the measurements speak for themselves.
const EVIDENCE: Record<StockPairEvidenceStatus, string | null> = {
  computed: null,
  insufficient_data: 'Insufficient data',
  invalid_security: 'Not a supported stock',
  price_unavailable: 'Prices unavailable',
  price_stale: 'Prices out of date',
  undefined: 'Statistic undefined',
}

function formatTimestamp(value: string) {
  // The viewer's own locale and time zone, with the zone named.
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'string') return error.detail
  return error instanceof Error ? error.message : 'The pair search failed. Please try again.'
}

function PairCandidateRow({
  item,
  window,
  targetTicker,
}: {
  item: StockPairItemOut
  window: PairWindow
  targetTicker: string
}) {
  // Kept per row (rows are keyed by ticker), so an open plot follows its candidate
  // when the window changes the order.
  const [plotOpen, setPlotOpen] = useState(false)
  const plotId = useId()
  const strength = STRENGTH[item.strength]
  const evidence = EVIDENCE[item.evidence_status]
  const measured = item.three_month !== null || item.six_month !== null
  // A listing already known to be unsupported cannot be analyzed; say why instead.
  const strategyDisabledReason =
    item.evidence_status === 'invalid_security'
      ? (item.reasons[0] ?? `${item.ticker} is not a supported NYSE or Nasdaq stock.`)
      : undefined
  return (
    <li className="border-border space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link to={`/stocks/${item.ticker}`} className="font-semibold hover:underline">
          {item.ticker}
        </Link>
        {item.company_name && <span className="text-muted-foreground text-sm">{item.company_name}</span>}
        {item.exchange && <span className="text-muted-foreground text-xs">{item.exchange}</span>}
        <span className="text-muted-foreground text-xs">Historical co-movement</span>
        <Badge variant={strength.variant}>{strength.label}</Badge>
        {evidence && <Badge variant="outline">{evidence}</Badge>}
      </div>
      <PairCorrelations item={item} />
      <PairBusinessEvidence evidence={item.business_evidence ?? null} explanation={item.explanation} />
      {item.reasons.length > 0 && (
        <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
          {/* Reasons and warnings may repeat; the index keeps each key unique. */}
          {item.reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      )}
      {measured && <PairMetrics item={item} window={window} />}
      {measured && (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={plotOpen}
            aria-controls={plotId}
            onClick={() => setPlotOpen((open) => !open)}
          >
            {plotOpen ? 'Hide daily-return scatter plot' : 'View daily-return scatter plot'}
          </Button>
          <div id={plotId}>
            {/* Mounted only while open, and keyed so each window draws its own sample. */}
            {plotOpen && (
              <PairScatterPlot key={window} targetTicker={targetTicker} item={item} window={window} />
            )}
          </div>
        </div>
      )}
      {/* Keyed by the ordered pair, so re-sorting or a new report never hands one
          pair's analysis, pending request or error to another. */}
      <PairStrategyPanel
        key={`${targetTicker}:${item.ticker}`}
        ticker={targetTicker}
        candidateTicker={item.ticker}
        disabledReason={strategyDisabledReason}
      />
      {/* A sibling, not a child: today's analysis (absent, loading, failed or any
          finding) never gates the historical backtest, and both stay visible. */}
      <PairBacktestPanel
        key={`backtest:${targetTicker}:${item.ticker}`}
        ticker={targetTicker}
        candidateTicker={item.ticker}
        disabledReason={strategyDisabledReason}
      />
    </li>
  )
}

function PairsReport({
  report,
  window,
  onWindowChange,
}: {
  report: StockPairsOut
  window: PairWindow
  onWindowChange: (window: PairWindow) => void
}) {
  const hasStrong = report.items.some((item) => item.strength === 'strong')
  // A sorted copy: the cached report keeps Google's order.
  const ranked = useMemo(() => rankPairItems(report.items, window), [report.items, window])
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle>Possible pairs for {report.ticker}</CardTitle>
        <div className="text-muted-foreground space-y-0.5 text-xs">
          <p>
            Google response received:{' '}
            <time dateTime={report.generated_at}>{formatTimestamp(report.generated_at)}</time>
          </p>
          <p>
            Verified: <time dateTime={report.verified_at}>{formatTimestamp(report.verified_at)}</time>
          </p>
          <p>
            Prices through: <time dateTime={report.data_through}>{formatDate(report.data_through)}</time>{' '}
            (adjusted daily closes)
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="group" aria-label="Measurement window" className="flex flex-wrap gap-2">
          {WINDOWS.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={window === value ? 'default' : 'outline'}
              aria-pressed={window === value}
              onClick={() => onWindowChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {report.items.length === 0 ? (
          <p className="text-sm font-medium">Google Finance found no supported candidates</p>
        ) : (
          !hasStrong && <p className="text-sm font-medium">No strong pairs confirmed</p>
        )}

        {report.warnings.length > 0 && (
          <ul aria-label="Report warnings" className="text-muted-foreground space-y-1 text-xs">
            {report.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        )}

        {report.items.length > 0 && (
          <div className="space-y-3">
            <div className="text-muted-foreground space-y-1 text-xs">
              <p>Sorted by {WINDOW_NAMES[window]} correlation among Google&apos;s suggestions</p>
              <p>
                Strength badges describe historical co-movement of daily returns and require both
                the 3- and 6-month windows. Business evidence is checked separately and never
                changes them.
              </p>
              <p>
                A checked source passage means the quoted sentence was found on the cited page and
                names the company; it does not confirm Google&apos;s interpretation.
              </p>
            </div>
            <ul aria-label="Pair candidates" className="space-y-3">
              {ranked.map((item) => (
                <PairCandidateRow
                  key={item.ticker}
                  item={item}
                  window={window}
                  targetTicker={report.ticker}
                />
              ))}
            </ul>
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Google Finance research and sources</summary>
          <div className="mt-3 space-y-4">
            <MessageResponse mode="static">{report.answer_markdown}</MessageResponse>
            {report.sources.length > 0 && (
              <ul aria-label="Google Finance sources" className="space-y-2">
                {report.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {source.title}
                    </a>
                    {source.publisher && (
                      <span className="text-muted-foreground"> · {source.publisher}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <p className="text-muted-foreground text-xs">{report.caveat}</p>
      </CardContent>
    </Card>
  )
}

function PairsPanel({ ticker }: { ticker: string }) {
  const query = useStockPairs(ticker)
  const search = useRefreshStockPairs(ticker)
  const [window, setWindow] = useState<PairWindow>('six_month')
  const report = query.data && query.data.ticker === ticker ? query.data : null

  if (query.isPending) return <Skeleton className="h-72 rounded-xl" />
  if (query.isError && !report) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }

  const pendingText = report ? 'Refreshing pairs…' : 'Finding and checking pairs…'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Google Finance suggests up to five stocks that have tended to move with {ticker}; each
          is checked against adjusted daily closes. Saved for future visits; refresh whenever you
          want a new check.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={search.isPending}
          onClick={() => search.mutate(report !== null)}
        >
          {search.isPending ? <Spinner aria-hidden /> : report ? <RefreshCw /> : <Search />}
          {search.isPending ? pendingText : report ? 'Refresh' : 'Find pairs'}
        </Button>
      </div>

      {search.isPending && (
        <p role="status" className="text-muted-foreground text-sm">
          {pendingText}
        </p>
      )}
      {!search.isPending && search.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage(search.error)}
        </p>
      )}

      {report && <PairsReport report={report} window={window} onWindowChange={setWindow} />}
    </div>
  )
}

export function PairsTab({ ticker }: { ticker: string }) {
  const symbol = pairTicker(ticker)
  // Keyed by ticker: the window choice, a pending search and its error never carry
  // over to another stock. A search that finishes later is saved under its own ticker.
  return <PairsPanel key={symbol} ticker={symbol} />
}
