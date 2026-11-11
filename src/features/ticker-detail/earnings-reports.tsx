import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Verification } from '@/components/shared/filing-key-facts'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatFilingDate, formatTimestamp } from '@/lib/format'
import { displayAmount, verificationMark } from '@/lib/sec-verification'
import { cn } from '@/lib/utils'
import type { EarningsReportOut, FilingEvidence, FilingFinding, FilingKeyFact } from '@/types/api'
import { useEarningsReports, useRefreshEarningsReports } from './earnings-report-hooks'

const TABS = [
  { value: 'highlights', label: 'Highlights', topics: ['performance'] },
  { value: 'guidance', label: 'Guidance', topics: ['guidance'] },
  { value: 'developments', label: 'Developments', topics: ['liquidity', 'financing', 'agreement', 'leadership', 'other'] },
  { value: 'risks', label: 'Risks & notes', topics: ['risk', 'accounting'] },
]
const IMPORTANCE = { high: 0, medium: 1, low: 2 }
const DOT: Record<FilingFinding['direction'], string> = {
  positive: 'bg-emerald-600', negative: 'bg-red-600', mixed: 'bg-amber-500',
  neutral: 'bg-muted-foreground/50', unclear: 'bg-muted-foreground/50',
}
const MARK_TONE = { ok: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', muted: 'text-muted-foreground' }

function Evidence({ evidence }: { evidence: FilingEvidence }) {
  return <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground">
    <p className="whitespace-normal">“{evidence.excerpt}”</p>
    <a href={evidence.source_url} target="_blank" rel="noreferrer" className="underline">
      SEC source · {evidence.section}
    </a>
  </blockquote>
}

function periodLabel(fact: FilingKeyFact) {
  const date = fact.period_end ? formatDate(fact.period_end) : fact.period
  const kind = { instant: 'As of', quarter: 'Quarter ·', annual: 'Year ·', year_to_date: 'YTD ·', not_disclosed: '' }[fact.period_kind]
  return kind ? `${kind} ${date}` : fact.period
}

function ValueChip({ fact }: { fact: FilingKeyFact }) {
  const check = fact.sec_verification
  // The SEC value leads once the 10-Q/10-K disagrees with the press release.
  const secValue = check?.status === 'differs' ? check.sec_value_scaled : null
  const mark = check ? verificationMark(fact, check) : null
  return <details className={cn('rounded-lg border px-3 py-2', secValue ? 'border-amber-500 bg-amber-500/10' : 'bg-muted/30')}>
    <summary className="cursor-pointer list-none">
      <span className="block text-xs text-muted-foreground">
        {fact.basis === 'adjusted' ? 'Adjusted ' : fact.basis === 'gaap' ? 'GAAP ' : ''}{fact.label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <strong className="text-base">{displayAmount(fact, secValue ?? fact.value)}</strong>
        {mark && <span aria-label={mark.label} title={mark.label} className={cn('text-xs font-semibold', MARK_TONE[mark.tone])}>{mark.symbol}</span>}
      </span>
      <span className="block text-xs text-muted-foreground">{periodLabel(fact)}</span>
    </summary>
    <div className="mt-2 flex max-w-sm flex-col gap-2">
      {check && <Verification fact={fact} check={check} />}
      {fact.evidence.map((item, index) => <Evidence key={index} evidence={item} />)}
    </div>
  </details>
}

function FindingLine({ finding }: { finding: FilingFinding }) {
  return <li className="border-b last:border-b-0">
    <details className="group py-1.5">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[finding.direction])} />
        <span className="sr-only">{finding.direction}</span>
        <span className="min-w-0 flex-1 truncate group-open:whitespace-normal">{finding.fact}</span>
      </summary>
      <div className="ml-4 mt-1 flex flex-col gap-2 pb-1">
        <p className="text-sm text-muted-foreground">{finding.why_it_matters}</p>
        <Evidence evidence={finding.evidence} />
        {finding.prior_evidence && <div className="flex flex-col gap-1 text-xs">
          <p>Previous disclosure:</p><Evidence evidence={finding.prior_evidence} />
        </div>}
        {finding.numbers.map((number, i) => <div key={i} className="flex flex-col gap-1 text-xs">
          <p>{number.name}: {number.value} {number.unit} · {number.period} · {number.comparison_basis}</p>
          <Evidence evidence={number.evidence} />
        </div>)}
      </div>
    </details>
  </li>
}

function coverageNote(report: EarningsReportOut) {
  const { analysis } = report
  const coverage = analysis.coverage
  const total = coverage?.chunks_total
  const progress = total ? `${coverage?.chunks_processed ?? 0} of ${total} parts processed.` : null
  const fullText = coverage?.source_text_complete === true
  if (analysis.status !== 'partial' || fullText) return { fullText, progress, line: null }
  return {
    fullText, progress,
    line: coverage?.document_discovery_complete === false
      ? 'SEC document discovery is incomplete. Refresh SEC reports to retry missing disclosures.'
      : progress
        ? `${progress} Some source text could not be fully assessed. Refresh SEC reports to retry remaining parts.`
        : 'Some source text or findings could not be fully assessed. Review the cited disclosure for context.',
  }
}

function EarningsBrief({ report }: { report: EarningsReportOut }) {
  const { analysis } = report
  const facts = analysis.key_facts ?? []
  const findings = [...(analysis.findings ?? [])].sort(
    (a, b) => (IMPORTANCE[a.importance] ?? 1) - (IMPORTANCE[b.importance] ?? 1),
  )
  const guidanceFacts = facts.filter((fact) => fact.metric === 'guidance')
  const lists = TABS.map((tab) => findings.filter((finding) => tab.topics.includes(finding.topic)))
  const counts = lists.map((list, i) => list.length + (TABS[i].value === 'guidance' ? guidanceFacts.length : 0))
  const [tab, setTab] = useState(TABS[Math.max(0, counts.findIndex((count) => count > 0))].value)
  const ready = analysis.status === 'completed' || analysis.status === 'partial'
  const { fullText, progress, line } = coverageNote(report)
  return <article className="flex min-w-0 flex-col gap-3 whitespace-normal">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">{report.form_type}</Badge>
      <span>Filed {formatTimestamp(report.available_at)}</span>
      <a href={report.filing_url} target="_blank" rel="noreferrer" className="underline">SEC filing</a>
      {fullText && <Badge variant="outline" title={analysis.status === 'partial'
        ? 'Unverified claims were excluded; all release text was processed. Review the cited disclosures for context.'
        : 'All release text was processed.'}>Full release read</Badge>}
      {analysis.status === 'partial' && !fullText && <Badge variant="secondary">Partial coverage</Badge>}
    </div>
    {analysis.status === 'pending'
      ? <p className="text-sm text-muted-foreground">Queued for analysis. Refresh SEC reports to check for updates.</p>
      : analysis.status === 'not_analyzed'
        ? <p className="text-sm text-muted-foreground">Analysis not started. Refresh SEC reports to analyze this release.</p>
      : analysis.status === 'processing'
        ? <p className="text-sm text-muted-foreground" role="status">Analyzing earnings release… {progress}</p>
        : analysis.status === 'failed'
          ? <p className="text-sm text-muted-foreground">Analysis unavailable. Read the filing or refresh SEC reports to retry.</p>
          : null}
    {ready && <>
      {line && <p className="text-xs text-muted-foreground">{line}</p>}
      {facts.some((fact) => fact.metric !== 'guidance') && <div className="flex flex-wrap items-start gap-2" aria-label="Reported results">
        {facts.filter((fact) => fact.metric !== 'guidance').map((fact, i) => <ValueChip key={i} fact={fact} />)}
      </div>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          {TABS.map((item, i) => <TabsTrigger key={item.value} value={item.value}>
            {item.label} <span className="text-muted-foreground">{counts[i]}</span>
          </TabsTrigger>)}
        </TabsList>
        {TABS.map((item, i) => <TabsContent key={item.value} value={item.value}>
          {item.value === 'guidance' && <div className="flex flex-col gap-2 pb-1">
            <p className="text-xs text-muted-foreground">Management forecasts; actual outcomes may differ.</p>
            {guidanceFacts.length > 0 && <div className="flex flex-wrap items-start gap-2">
              {guidanceFacts.map((fact, j) => <ValueChip key={j} fact={fact} />)}
            </div>}
          </div>}
          {lists[i].length
            ? <ul>{lists[i].map((finding, j) => <FindingLine key={j} finding={finding} />)}</ul>
            : counts[i] === 0 && <p className="py-2 text-sm text-muted-foreground">
              {item.value !== 'guidance'
                ? 'None identified in this release.'
                : analysis.status === 'partial' && !fullText
                  ? 'Guidance could not be fully assessed from the available text.'
                  : 'No guidance identified in the analyzed text.'}
            </p>}
        </TabsContent>)}
      </Tabs>
    </>}
  </article>
}

function pillLabel(value: string, newest: string) {
  const year = (date: string) => formatFilingDate(date, { year: 'numeric' })
  return formatFilingDate(value, {
    month: 'short', day: 'numeric',
    ...(year(value) !== year(newest) ? { year: 'numeric' } : {}),
  })
}

export function EarningsReportsPanel({ ticker }: { ticker: string }) {
  const query = useEarningsReports(ticker)
  const refresh = useRefreshEarningsReports(ticker)
  const [selected, setSelected] = useState(0)
  const reports = query.data?.reports ?? []
  const report = reports[Math.min(selected, Math.max(0, reports.length - 1))]
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>SEC earnings briefs</CardTitle>
          {reports.length > 1 && reports.map((item, index) => <Button
            key={item.filing_id} size="sm" variant={item === report ? 'default' : 'outline'}
            className="h-7 rounded-full px-3 text-xs" aria-pressed={item === report}
            title={formatTimestamp(item.available_at)} onClick={() => setSelected(index)}>
            {pillLabel(item.available_at, reports[0].available_at)}
          </Button>)}
        </div>
        <Button variant="outline" size="sm" disabled={refresh.isPending || query.data?.enabled === false}
          onClick={() => refresh.mutate(undefined, {
            onSuccess: (result) => result.error
              ? toast.warning(`SEC reports could not be refreshed: ${result.error}`)
              : toast.success(result.queued ? 'Earnings releases queued for analysis.' : 'Saved earnings releases are up to date.'),
            onError: () => toast.error('Could not refresh SEC earnings reports.'),
          })}>
          <RefreshCw className={cn(refresh.isPending && 'animate-spin')} />
          {refresh.isPending ? 'Checking SEC filings…' : 'Refresh SEC reports'}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      {query.isPending ? <Skeleton className="h-32" /> : query.isError
        ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
        : <>
          {query.data?.enabled === false && <p className="text-sm text-muted-foreground">Earnings brief collection is disabled. Saved reports remain available.</p>}
          {!report ? <EmptyState title="No SEC earnings release saved yet"
            description="Refresh SEC reports to look for the latest earnings release." />
            : <EarningsBrief report={report} key={report.filing_id} />}
        </>}
    </CardContent>
  </Card>
}
