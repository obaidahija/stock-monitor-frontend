import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatEasternDateTime, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FinancialMetric, FinancialPeriod, FinancialPeriodRow } from '@/types/sec-fundamentals'
import { useFinancialHistory, useFinancialRefresh } from './hooks'

const METRICS: Record<string, string> = {
  revenue: 'Revenue', operating_income: 'Operating income', net_income: 'Net income',
  operating_cash_flow: 'Operating cash flow', capital_expenditure: 'Capital expenditure',
  free_cash_flow: 'Free cash flow', cash: 'Cash', assets: 'Assets', liabilities: 'Liabilities',
  equity: 'Equity', debt: 'Debt', net_debt: 'Net debt', operating_margin: 'Operating margin',
  net_margin: 'Net margin', revenue_growth_yoy: 'Revenue growth YoY', revenue_ttm: 'Revenue TTM',
  net_income_ttm: 'Net income TTM', operating_cash_flow_ttm: 'Operating cash flow TTM',
  free_cash_flow_ttm: 'Free cash flow TTM',
}

function humanize(value: string) {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Preserve the API's decimal precision, including values beyond JS's safe integer range.
function formatFinancialValue(metric?: FinancialMetric) {
  if (metric?.value == null || !/^-?\d+(?:\.\d+)?$/.test(metric.value)) return 'Unavailable'
  const negative = metric.value.startsWith('-')
  const [whole, fraction = ''] = metric.value.replace(/^-/, '').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = metric.unit === 'USD' ? fraction.padEnd(2, '0') : fraction
  return `${negative ? '-' : ''}${metric.unit === 'USD' ? '$' : ''}${grouped}${decimals ? `.${decimals}` : ''}${metric.unit === 'percent' ? '%' : ''}`
}

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined
  } catch { return undefined }
}

function MetricEvidence({ metric }: { metric: FinancialMetric }) {
  return (
    <details>
      <summary className="text-muted-foreground cursor-pointer text-xs">Sources and calculation</summary>
      <div className="mt-2 flex max-w-sm flex-col gap-2 whitespace-normal text-xs">
        <p>{metric.method === 'derived' ? 'Calculated from the source operands below.' : 'Reported in the source filing.'}</p>
        {metric.comparability === 'unknown' && <p>Comparability unknown.</p>}
        {metric.reasons.map((reason) => <p key={reason}>{humanize(reason)}</p>)}
        {metric.sources.length === 0 && <p>No source fact available.</p>}
        {metric.sources.map((source) => (
          <div key={`${source.fact_id}-${source.accession}`} className="flex flex-col gap-1">
            <a href={safeSourceUrl(source.source_url)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {source.form} · filed {source.filed} · {source.accession}
            </a>
            <p>{source.concept} · fact {source.fact_id}</p>
            <p>Available {source.available_at} · {humanize(source.availability_precision)}</p>
            <p>Accepted {source.accepted_at ?? 'Unknown'}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

export function FinancialPeriodsTable({ periods, mode = 'history' }: { periods: FinancialPeriodRow[]; mode?: 'history' | 'evidence' }) {
  const keys = [...new Set(periods.flatMap((period) => Object.keys(period.metrics)))]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric · USD unless %</TableHead>
          {periods.map((period) => (
            <TableHead key={`${period.period_type}-${period.period_end}`}>
              <div>{period.fiscal_label ?? (period.period_type === 'annual' ? 'Annual' : 'Quarterly')}</div>
              <div>{period.period_type === 'annual' ? 'Annual' : 'Quarterly'} · {period.period_end}</div>
              <div className="text-xs">{period.period_start ? `${period.period_start} to ${period.period_end}` : `As of ${period.period_end}`}</div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key}>
            <TableCell className="align-top font-medium">{METRICS[key] ?? humanize(key)}</TableCell>
            {periods.map((period) => {
              const metric = period.metrics[key]
              const omitted = !metric && mode === 'evidence'
              return (
                <TableCell key={`${period.period_type}-${period.period_end}`} className="align-top">
                  <div className="flex flex-col items-start gap-1">
                    <span className="tabular-nums">{omitted ? 'Not included in report inputs' : formatFinancialValue(metric)}</span>
                    {metric ? <>
                      <Badge variant="outline">{metric.method === 'derived' ? 'Calculated' : 'Reported'}</Badge>
                      {metric.comparability === 'mixed_filings' && <Badge variant="secondary">Mixed filings</Badge>}
                      {metric.reasons.map((reason) => <span key={reason} className="text-muted-foreground text-xs">{humanize(reason)}</span>)}
                      <MetricEvidence metric={metric} />
                    </> : !omitted && <span className="text-muted-foreground text-xs">No comparable source fact.</span>}
                  </div>
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Financial history could not be loaded.'
}

function FinancialHistoryContent({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<FinancialPeriod>('quarterly')
  const history = useFinancialHistory(ticker, period)
  const data = history.data
  const { refresh, status, result, isRefreshing } = useFinancialRefresh(ticker, data?.refresh)
  const latest = data?.periods[0]
  const reportingDays = data?.latest_period_end
    ? Math.max(0, Math.floor((Date.now() - Date.parse(data.latest_period_end)) / 86400000)) : null
  return (
    <Card aria-label={`${ticker} financial history`}>
      <CardHeader>
        <CardTitle>Financial history</CardTitle>
        <CardDescription>Context for research from SEC filings. Independent of the scored Fundamentals factor.</CardDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as FinancialPeriod)}>
            <SelectTrigger aria-label="Financial reporting period"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={!data?.collection_enabled || isRefreshing} onClick={() => refresh.mutate()}>
            <RefreshCw data-icon="inline-start" className={cn(isRefreshing && 'animate-spin')} />
            Refresh financial history
          </Button>
          {data && <Badge variant="secondary">{humanize(data.quality.status)}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {history.isPending && <Skeleton className="h-28" aria-label="Loading financial history" />}
        {history.isError && <Alert variant="destructive">
          <AlertTitle>Financial history read failed</AlertTitle>
          <AlertDescription>{message(history.error)}{data && ' Saved figures remain visible.'}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void history.refetch()}>Retry loading financial history</Button>
        </Alert>}
        {data?.collection_enabled === false && <p className="text-muted-foreground text-sm">Collection is disabled. Saved financial history remains available.</p>}
        {isRefreshing && <p role="status">Financial history refresh {result?.state ?? 'requesting'}; saved figures remain visible.</p>}
        {(refresh.isError || status.isError || result?.state === 'failed') && <Alert variant="destructive">
          <AlertTitle>Financial history refresh failed</AlertTitle>
          <AlertDescription>{refresh.error ? message(refresh.error) : status.error ? message(status.error) : result?.error ?? 'Refresh failed.'} Saved figures remain visible.</AlertDescription>
          {status.isError && <Button variant="outline" size="sm" onClick={() => void status.refetch()}>Retry refresh status</Button>}
        </Alert>}
        {result?.state === 'completed' && <p role="status">Financial history refresh completed.</p>}
        {data && <>
          {data.periods.length > 0 && (data.quality.status === 'unavailable' || data.quality.status === 'unsupported' || data.quality.reasons.some((reason) => reason.includes('last_known') || reason === 'coverage_regression')) && <Alert>
            <AlertDescription>Showing last-known financial history. The latest collection did not replace these saved figures; review coverage and source dates.</AlertDescription>
          </Alert>}
          <div className="text-muted-foreground flex flex-col gap-1 text-xs">
            <p>Latest reporting period: {data.latest_period_end ?? 'Unavailable'} · Reporting age: {reportingDays === null ? 'Unknown' : `${reportingDays} days`}</p>
            <p>Latest source filing: {data.latest_filing_date ?? 'Unavailable'}</p>
            <p>Last checked: {data.checked_at ? `${formatEasternDateTime(data.checked_at)} (${formatRelativeTime(data.checked_at)})` : 'Never'}</p>
            <p>Source observed: {data.observed_at ? formatEasternDateTime(data.observed_at) : 'Never'} · Published: {data.published_at ? formatEasternDateTime(data.published_at) : 'Never'}</p>
            <p>Coverage: {data.coverage.quarterly_periods} quarters · {data.coverage.annual_periods} annual periods · {data.coverage.metrics_available}/{data.coverage.metrics_expected} metrics available</p>
            {data.snapshot_id !== null && <p>Snapshot {data.snapshot_id} · publication {data.publication_id ?? 'Unavailable'} · CIK {data.cik ?? 'Unknown'}</p>}
          </div>
          {data.quality.reasons.length > 0 && <Alert>
            <AlertTitle>Financial history coverage</AlertTitle>
            <AlertDescription>{data.quality.reasons.map(humanize).join(' · ')}</AlertDescription>
          </Alert>}
          {data.pending_filings.length > 0 && <Alert><AlertDescription>Pending SEC financial facts for filing(s): {data.pending_filings.join(', ')}. Saved figures may predate these filings.</AlertDescription></Alert>}
          {data.periods.length === 0 ? <p className="text-muted-foreground text-sm">No saved financial history for this reporting period.</p> : <>
            {latest && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {['revenue', 'net_income', 'operating_cash_flow', 'free_cash_flow'].map((key) => (
                <div key={key} className="flex min-w-0 flex-col gap-1">
                  <p className="text-muted-foreground text-xs">{METRICS[key]} · {latest.fiscal_label ?? latest.period_end}</p>
                  <p className="break-words font-medium tabular-nums">{formatFinancialValue(latest.metrics[key])}</p>
                  {latest.metrics[key]?.method === 'derived' && <p className="text-muted-foreground text-xs">Calculated</p>}
                </div>
              ))}
            </div>}
            <details>
              <summary className="cursor-pointer text-sm">Figures and source filings</summary>
              <div className="mt-3 min-w-0"><FinancialPeriodsTable periods={data.periods} /></div>
            </details>
          </>}
          <p className="text-muted-foreground text-xs">Latest available disclosure for each period; later disclosures can revise older figures. Calculated values retain their source operands. Coverage does not measure financial health.</p>
        </>}
      </CardContent>
    </Card>
  )
}

export function FinancialHistory({ ticker }: { ticker: string }) {
  // Reset period/mutation state on navigation; cache and status are also ticker-scoped.
  return <FinancialHistoryContent key={ticker.toUpperCase()} ticker={ticker.toUpperCase()} />
}
