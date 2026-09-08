import { useEffect, useState } from 'react'
import { InsightSummaryCard } from '@/components/shared/insight-summary-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import {
  DEFAULT_FILING_CHANGE_FILTERS,
  FILING_SECTION_LABELS,
} from '@/types/filing-changes'
import type {
  FilingChangeFilters,
  FilingComparisonOut,
  FilingSectionKey,
  SectionCoveragePairOut,
} from '@/types/filing-changes'
import { FilingChangeCard } from './filing-change-card'
import {
  useCompareAnnualFilings,
  useExplainFilingChanges,
  useFilingChangePage,
  useFilingChanges,
  useFilingInsightSummary,
  useRefreshFilingInsightSummary,
} from './hooks'

const ALL = 'all'

const NOTICE_COPY: Record<string, string> = {
  amendments_present:
    'Original annual filings compared; amendments are not incorporated.',
}

const COVERAGE_COPY: Record<string, string> = {
  missing: 'could not be located in this filing',
  ambiguous: 'could not be located unambiguously in this filing',
  too_large: 'was too large to compare',
}

const FAILURE_COPY: Record<string, string> = {
  insufficient_history: 'Two comparable annual 10-K filings are needed. SEC history currently contains only one.',
  unsupported_or_missing_10k: 'No original annual 10-K was found for this ticker. Other annual forms are not supported yet.',
  ambiguous_pair: 'The annual reporting periods could not be matched reliably. Review the original filings.',
  history_limit_reached: 'The historical search limit was reached before a reliable annual pair could be established.',
  comparison_timed_out: 'The comparison took too long. Try again; saved evidence is retained.',
  no_comparable_sections: 'Neither Risk Factors nor MD&A could be read reliably in both filings.',
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
}

function formatTimestamp(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString()
}

/**
 * One line per section that failed to extract on either side. Deliberately
 * phrased as unavailable evidence: a section we could not read is never
 * described as unchanged or removed.
 */
function CoverageNotes({
  coverage,
}: {
  coverage: Partial<Record<FilingSectionKey, SectionCoveragePairOut>>
}) {
  const problems: string[] = []
  const notes = new Set<string>()

  for (const [key, pair] of Object.entries(coverage) as [
    FilingSectionKey,
    SectionCoveragePairOut,
  ][]) {
    for (const [side, entry] of [
      ['earlier', pair.before],
      ['later', pair.after],
    ] as const) {
      if (entry.status !== 'ok') {
        problems.push(
          `${FILING_SECTION_LABELS[key]} ${COVERAGE_COPY[entry.status] ?? 'was unavailable'} (${side} filing), so it was not compared.`,
        )
      }
      entry.notes.forEach((note) => notes.add(note))
    }
  }

  if (problems.length === 0 && notes.size === 0) return null

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      {problems.map((problem) => (
        <p key={problem}>{problem}</p>
      ))}
      {notes.has('numeric_tables_excluded') && (
        <p>
          Numeric financial tables are excluded from this prose comparison, so it does not
          cover the complete filing.
        </p>
      )}
      {notes.has('repeated_page_headers_removed') && (
        <p>Repeated page headers were treated as page furniture, not disclosure.</p>
      )}
    </div>
  )
}

function Summary({ comparison }: { comparison: FilingComparisonOut }) {
  const { before, after, counts } = comparison
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          FY ending {formatDate(before.report_date)}{' '}
          <a
            href={before.filing_url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground underline"
          >
            (filed {formatDate(before.filed_date)})
          </a>
        </span>
        <span aria-hidden>→</span>
        <span>
          FY ending {formatDate(after.report_date)}{' '}
          <a
            href={after.filing_url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground underline"
          >
            (filed {formatDate(after.filed_date)})
          </a>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{counts.added} added</Badge>
        <Badge variant="outline">{counts.removed} removed</Badge>
        <Badge variant="outline">{counts.modified} modified</Badge>
        {comparison.status === 'partial' && <Badge variant="outline">Partial coverage</Badge>}
      </div>
      <p className="text-muted-foreground text-xs">
        Compared {formatTimestamp(comparison.generated_at)} · SEC metadata last checked{' '}
        {formatTimestamp(comparison.metadata_checked_at)}
      </p>
      {comparison.notices.map((notice) => (
        <p key={notice} className="text-muted-foreground text-xs">
          {NOTICE_COPY[notice] ?? notice}
        </p>
      ))}
      <CoverageNotes coverage={comparison.coverage} />
    </div>
  )
}

export function FilingChangesPanel({ ticker }: { ticker: string }) {
  return <TickerFilingChanges key={ticker} ticker={ticker} />
}

function TickerFilingChanges({ ticker }: { ticker: string }) {
  const insight = useFilingInsightSummary(ticker)
  const refreshInsight = useRefreshFilingInsightSummary(ticker)
  const saved = useFilingChanges(ticker)
  const comparison = saved.data ?? null
  const compare = useCompareAnnualFilings(ticker)
  const explain = useExplainFilingChanges(ticker, comparison?.id)

  const [filters, setFilters] = useState<FilingChangeFilters>(
    DEFAULT_FILING_CHANGE_FILTERS,
  )
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  // A page offset only means something for the filter set and comparison it
  // was produced under; carrying it across either would show the wrong slice.
  useEffect(() => {
    setFilters((current) => ({ ...current, offset: 0 }))
  }, [comparison?.id])

  const page = useFilingChangePage(ticker, comparison?.id, filters, evidenceOpen)

  const update = (patch: Partial<FilingChangeFilters>) =>
    setFilters((current) => ({ ...current, ...patch, offset: 0 }))

  const compareFailure =
    compare.data && (compare.data.status === 'unavailable' || !compare.data.source.ok)
      ? (FAILURE_COPY[compare.data.reason ?? ''] ?? compare.data.source.error ?? 'The comparison could not be refreshed.')
      : null
  const comparedSections = Object.entries(comparison?.coverage ?? {}).filter(
    ([, pair]) => pair.before.status === 'ok' && pair.after.status === 'ok',
  )

  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4">
      <InsightSummaryCard
        title="Annual filing changes"
        summary={insight.data ?? null}
        isRefreshing={refreshInsight.isPending}
        refreshError={refreshInsight.error ?? insight.error}
        onRefresh={() => refreshInsight.mutate()}
      />

      <details
        className="group min-w-0 rounded-xl border bg-card"
        onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex flex-col gap-0.5">
            <span>Evidence &amp; All Changes</span>
            <span className="text-xs font-normal text-muted-foreground">
              Filing pair, source links, filters, raw diffs, and troubleshooting tools
            </span>
          </span>
        </summary>

    <Card className="border-0 py-4 shadow-none ring-0">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Comparison evidence &amp; tools</CardTitle>
          <CardDescription className="mt-1 max-w-xl text-xs">
            Compares Item 1A (Risk Factors) and Item 7 (MD&amp;A) between the two most
            recent original 10-K filings. These are disclosure changes: added wording does
            not prove a new risk arose, and removed wording does not prove one was resolved.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => compare.mutate()}
          disabled={compare.isPending || explain.isPending}
        >
          {compare.isPending ? 'Comparing…' : 'Compare latest annual filings'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

      {compareFailure && (
        <Alert><AlertDescription>
          Could not refresh from SEC. {compareFailure}
          {comparison ? ' Showing the last saved comparison.' : ''}
        </AlertDescription></Alert>
      )}
      {compare.isError && <ErrorState error={compare.error} />}
      {saved.isError && <ErrorState error={saved.error} onRetry={() => saved.refetch()} />}

      {saved.isPending && <Skeleton className="h-24 rounded-xl" />}

      {!saved.isPending && !saved.isError && !comparison && !compareFailure && (
        <p className="text-muted-foreground text-xs">
          No comparison saved yet. Use the button above to check EDGAR.
        </p>
      )}

      {comparison && (
        <>
          <Summary comparison={comparison} />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.section ?? ALL}
              onValueChange={(value) =>
                update({ section: value === ALL ? undefined : (value as FilingSectionKey) })
              }
            >
              <SelectTrigger size="sm" className="w-56" aria-label="Section">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value={ALL}>All sections</SelectItem>
                <SelectItem value="risk_factors">Risk Factors</SelectItem>
                <SelectItem value="mda">MD&amp;A</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={filters.kind ?? ALL}
              onValueChange={(value) =>
                update({
                  kind: value === ALL ? undefined : (value as FilingChangeFilters['kind']),
                })
              }
            >
              <SelectTrigger size="sm" className="w-40" aria-label="Change type">
                <SelectValue placeholder="All changes" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value={ALL}>All changes</SelectItem>
                <SelectItem value="added">Added</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
                <SelectItem value="modified">Modified</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={filters.topic ?? ALL}
              onValueChange={(value) =>
                update({
                  topic: value === ALL ? undefined : (value as FilingChangeFilters['topic']),
                })
              }
            >
              <SelectTrigger size="sm" className="w-44" aria-label="Topic">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectItem value={ALL}>All topics</SelectItem>
                <SelectItem value="unclassified">Unclassified</SelectItem>
                <SelectItem value="liquidity">Liquidity</SelectItem>
                <SelectItem value="demand">Demand</SelectItem>
                <SelectItem value="margins">Margins</SelectItem>
                <SelectItem value="competition">Competition</SelectItem>
                <SelectItem value="regulation">Regulation</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {comparison.routine_count > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ include_routine: !filters.include_routine })}
              >
                {filters.include_routine
                  ? 'Hide routine updates'
                  : `Show routine updates (${comparison.routine_count} hidden)`}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => explain.mutate()}
              disabled={explain.isPending || compare.isPending}
            >
              {explain.isPending ? 'Explaining…' : 'Explain changes'}
            </Button>
            <span className="text-muted-foreground text-xs">
              {comparison.explained_count} of{' '}
              {comparison.counts.added +
                comparison.counts.removed +
                comparison.counts.modified}{' '}
              changes explained
            </span>
          </div>

          {explain.isError && <ErrorState error={explain.error} onRetry={() => explain.mutate()} />}

          {comparison.ai_status === 'unavailable' && (
            <p className="text-muted-foreground text-xs">
              AI explanations are unavailable{comparison.ai_error ? ` (${comparison.ai_error})` : ''}
              . The compared passages below are unaffected.
            </p>
          )}

          {page.isPending && <Skeleton className="h-40 rounded-xl" />}
          {page.isError && <ErrorState error={page.error} onRetry={() => page.refetch()} />}

          {page.data && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">
                {page.data.total} matching {page.data.total === 1 ? 'change' : 'changes'}
              </p>

              {page.data.total === 0 &&
                (filters.section || filters.kind || filters.topic ? (
                  <p className="text-muted-foreground text-sm">
                    No changes match these filters.
                  </p>
                ) : comparedSections.length > 0 && !filters.include_routine && comparison.routine_count > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Only routine date updates were detected in the compared prose. Show routine updates to review them.
                  </p>
                ) : comparedSections.length > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No text changes detected in the compared prose of{' '}
                    {comparedSections
                      .map(([key]) => FILING_SECTION_LABELS[key as FilingSectionKey])
                      .join(' and ')}
                    .
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No sections could be compared, so no conclusion about changes is
                    possible.
                  </p>
                ))}

              {page.data.items.map((change) => (
                <FilingChangeCard
                  key={`${comparison.id}:${change.id}`}
                  change={change}
                  before={comparison.before}
                  after={comparison.after}
                />
              ))}

              {page.data.total > page.data.limit && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset === 0}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        offset: Math.max(0, current.offset - current.limit),
                      }))
                    }
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    {filters.offset + 1}–
                    {Math.min(filters.offset + page.data.limit, page.data.total)} of{' '}
                    {page.data.total}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset + page.data.limit >= page.data.total}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        offset: current.offset + current.limit,
                      }))
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </CardContent>
    </Card>
      </details>
    </div>
  )
}
