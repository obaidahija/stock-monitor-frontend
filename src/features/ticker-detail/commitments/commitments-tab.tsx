import { useState } from 'react'
import { InsightSummaryCard } from '@/components/shared/insight-summary-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import {
  DEFAULT_COMMITMENT_FILTERS,
  METRIC_LABELS,
  STATUS_LABELS,
  type CommitmentFilters,
  type SourceBlock,
} from '@/types/management-commitments'
import { CandidateReview } from './candidate-review'
import { CommitmentTimeline } from './commitment-timeline'
import { describeIdentity, formatPeriod, formatTarget, outcomeLabel, outcomeVariant } from './format'
import {
  useCommitments,
  useCommitmentSummary,
  useRefreshCommitmentSummary,
} from './hooks'
import { SourcePicker } from './source-picker'

type View = 'ledger' | 'sources'

const VIEWS: { id: View; label: string }[] = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'sources', label: 'Sources' },
]

/**
 * The Commitments tab: what management said, what changed, and what was
 * reported.
 *
 * Opening it issues GET requests only. Checking SEC and asking for proposals
 * are explicit buttons inside the Sources view; proposals are resolved
 * automatically, so there is no review queue to work through.
 */
export function CommitmentsTab({ ticker }: { ticker: string }) {
  const [view, setView] = useState<View>('ledger')
  const [filters, setFilters] = useState<CommitmentFilters>(DEFAULT_COMMITMENT_FILTERS)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | undefined>()
  const [manualEntry, setManualEntry] = useState<{
    documentId: number
    blocks: SourceBlock[]
  } | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const commitments = useCommitments(ticker, filters)
  const insight = useCommitmentSummary(ticker)
  const refreshInsight = useRefreshCommitmentSummary(ticker)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <InsightSummaryCard
        title="Management commitments"
        summary={insight.data ?? null}
        isRefreshing={refreshInsight.isPending}
        refreshError={refreshInsight.error ?? insight.error}
        onRefresh={() => refreshInsight.mutate()}
      />

      <details className="group min-w-0 rounded-xl border bg-card">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex flex-col gap-0.5">
            <span>Evidence &amp; Advanced</span>
            <span className="text-xs font-normal text-muted-foreground">
              Ledger and source documents
            </span>
          </span>
        </summary>

        <div className="flex min-w-0 flex-col gap-4 border-t p-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Commitments views">
        {VIEWS.map((entry) => (
          <Button
            key={entry.id}
            role="tab"
            aria-selected={view === entry.id}
            variant={view === entry.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {view === 'sources' && (
        <>
          <SourcePicker
            ticker={ticker}
            selectedDocumentId={selectedDocumentId}
            onSelectDocument={setSelectedDocumentId}
            onEnterManually={(documentId, blocks) => setManualEntry({ documentId, blocks })}
          />
          {manualEntry && (
            <CandidateReview
              ticker={ticker}
              commitments={commitments.data?.items ?? []}
              manualEntry={manualEntry}
              onManualEntryClosed={() => setManualEntry(null)}
            />
          )}
        </>
      )}

      {view === 'ledger' && (
        <Card>
          <CardHeader>
            <CardTitle>Management commitments</CardTitle>
            <CardDescription>
              Guidance management stated, how it changed, and how the reported result
              compared. Guidance is a forecast, not a guarantee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={filters.include_archived}
              onClick={() => setFilters((current) => ({
                ...current, include_archived: !current.include_archived, offset: 0,
              }))}
            >
              {filters.include_archived ? 'Hide archived' : 'Show archived'}
            </Button>
            {commitments.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : commitments.isError ? (
              <ErrorState error={commitments.error} onRetry={() => commitments.refetch()} />
            ) : commitments.data && commitments.data.items.length === 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  No commitments have been recorded for {ticker} yet.
                </p>
                <Button variant="outline" size="sm" onClick={() => setView('sources')}>
                  Find a source
                </Button>
              </div>
            ) : (
              <ul className="divide-border divide-y" data-testid="commitment-list">
                {commitments.data?.items.map((commitment) => {
                  const { projection, identity } = commitment
                  const expanded = expandedId === commitment.id
                  return (
                    <li key={commitment.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {METRIC_LABELS[identity.metric]} · {formatPeriod(identity)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {describeIdentity(identity)}
                            {projection.revision_count > 0 &&
                              ` · ${projection.revision_count} revision${projection.revision_count === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{STATUS_LABELS[projection.status]}</Badge>
                          {commitment.archived && <Badge variant="secondary">Archived</Badge>}
                        </div>
                      </div>

                      <dl className="grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground text-xs">Original target</dt>
                          <dd>
                            {projection.original
                              ? formatTarget(projection.original.target, identity)
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Latest target</dt>
                          <dd>
                            {projection.latest
                              ? formatTarget(projection.latest.target, identity)
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Reported result</dt>
                          <dd>{projection.actual ? projection.actual.value : '—'}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap items-center gap-2">
                        {projection.original_comparison && (
                          <Badge variant={outcomeVariant(projection.original_comparison.outcome)}>
                            {outcomeLabel(projection.original_comparison.outcome, 'original')}
                          </Badge>
                        )}
                        {projection.latest_comparison && (
                          <Badge variant={outcomeVariant(projection.latest_comparison.outcome)}>
                            {outcomeLabel(projection.latest_comparison.outcome, 'latest')}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : commitment.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? 'Hide history' : 'Show history'}
                        </Button>
                      </div>

                      {expanded && (
                        <CommitmentTimeline ticker={ticker} commitmentId={commitment.id} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {(filters.offset > 0 || (commitments.data?.total ?? 0) > filters.limit) && (
              <nav aria-label="Commitment pages" className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.offset === 0 || commitments.isFetching}
                  onClick={() => {
                    setExpandedId(null)
                    setFilters((current) => ({
                      ...current, offset: Math.max(0, current.offset - current.limit),
                    }))
                  }}
                >
                  Previous page
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {Math.floor(filters.offset / filters.limit) + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={commitments.isFetching || filters.offset + filters.limit >= (commitments.data?.total ?? 0)}
                  onClick={() => {
                    setExpandedId(null)
                    setFilters((current) => ({ ...current, offset: current.offset + current.limit }))
                  }}
                >
                  Next page
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      )}
        </div>
      </details>
    </div>
  )
}
