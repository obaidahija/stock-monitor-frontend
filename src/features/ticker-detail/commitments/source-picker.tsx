import { useState } from 'react'
import { ExternalLink, FileSearch, RefreshCw, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import type { SourceBlock, SourceRefOut } from '@/types/management-commitments'
import { SOURCE_NOTICE_COPY, formatDate, formatTimestamp } from './format'
import {
  useCheckCommitmentSources,
  useCommitmentSource,
  useCommitmentSources,
  useExtractCommitmentSource,
  useLoadCommitmentSource,
} from './hooks'

const BLOCK_PAGE = { offset: 0, limit: 100 }

interface SourcePickerProps {
  ticker: string
  selectedDocumentId: number | undefined
  onSelectDocument: (documentId: number | undefined) => void
  onEnterManually: (documentId: number, blocks: SourceBlock[]) => void
}

/**
 * Choose a source document, load it, and optionally ask for proposals.
 *
 * Mounting this performs GET requests only. `Check SEC` and `Extract` are the
 * two buttons that cost anything upstream, and neither runs on its own. A
 * selected document can be opened for manual entry with no provider involved
 * at all, which is what makes the feature usable with no AI configured.
 */
export function SourcePicker({
  ticker,
  selectedDocumentId,
  onSelectDocument,
  onEnterManually,
}: SourcePickerProps) {
  const sources = useCommitmentSources(ticker, { offset: 0, limit: 50 })
  const document = useCommitmentSource(ticker, selectedDocumentId, BLOCK_PAGE)
  const check = useCheckCommitmentSources(ticker)
  const load = useLoadCommitmentSource(ticker)
  const extract = useExtractCommitmentSource(ticker)
  const [extractionNote, setExtractionNote] = useState<string | null>(null)

  const coverage = sources.data?.coverage
  const neverChecked = coverage?.checked_at == null

  async function handleLoad(documentId: number) {
    onSelectDocument(documentId)
    // Failures render from the mutation's own state; an unhandled rejection
    // here would become an uncaught console error on every SEC hiccup.
    await load.mutateAsync({ documentId, params: BLOCK_PAGE }).catch(() => undefined)
  }

  async function handleExtract(documentId: number) {
    setExtractionNote(null)
    const result = await extract.mutateAsync(documentId).catch(() => null)
    if (result === null) {
      // The alert below is driven by the mutation's error state.
      return
    }
    if (result.status === 'ready') {
      setExtractionNote(
        result.candidate_count === 0
          ? 'No statements were proposed from this document. You can still add one manually.'
          : `${result.candidate_count} statement${result.candidate_count === 1 ? '' : 's'} proposed. Review them before anything is recorded.`,
      )
    } else if (result.status === 'running') {
      setExtractionNote('An extraction for this document is already running.')
    } else {
      setExtractionNote(
        SOURCE_NOTICE_COPY[result.reason ?? ''] ??
          'Extraction did not complete. Nothing was recorded; you can retry or add a statement manually.',
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sources</CardTitle>
            <CardDescription>
              8-K filings and their exhibits from the past two years. This is a bounded
              search, not complete company coverage.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => check.mutate()}
            disabled={check.isPending}
          >
            <RefreshCw className={check.isPending ? 'animate-spin' : undefined} />
            {check.isPending ? 'Checking SEC…' : 'Check SEC'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {check.data?.source.ok === false && (
          <Alert variant="destructive">
            <AlertDescription>
              SEC could not be reached. The sources below are the ones already saved.
            </AlertDescription>
          </Alert>
        )}

        {coverage && !neverChecked && (
          <p className="text-muted-foreground text-sm" data-testid="source-coverage">
            Last checked {formatTimestamp(coverage.checked_at)}. Scanned{' '}
            {coverage.filings_scanned} filing{coverage.filings_scanned === 1 ? '' : 's'} between{' '}
            {formatDate(coverage.window_start)} and {formatDate(coverage.window_end)}
            {coverage.complete ? '.' : ' (search limits were reached, so this is partial).'}
          </p>
        )}

        {coverage?.notices.map((notice) => (
          <p key={notice} className="text-muted-foreground text-sm">
            {SOURCE_NOTICE_COPY[notice] ?? notice}
          </p>
        ))}

        {sources.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sources.isError ? (
          <ErrorState error={sources.error} onRetry={() => sources.refetch()} />
        ) : sources.data && sources.data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {neverChecked
              ? 'No SEC check has been run for this ticker yet.'
              : 'The last check found no matching filings in the window.'}
          </p>
        ) : (
          <ul className="divide-border divide-y" data-testid="source-list">
            {sources.data?.items.map((source) => (
              <SourceRow
                key={source.document_id}
                source={source}
                selected={source.document_id === selectedDocumentId}
                busy={load.isPending && selectedDocumentId === source.document_id}
                onSelect={() => handleLoad(source.document_id)}
              />
            ))}
          </ul>
        )}

        {selectedDocumentId !== undefined && (
          <div className="border-border space-y-3 rounded-lg border p-3">
            {document.isPending || load.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : document.data && document.data.total_blocks > 0 ? (
              <>
                <p className="text-sm font-medium">
                  {document.data.total_blocks} passage
                  {document.data.total_blocks === 1 ? '' : 's'} available
                </p>
                {document.data.notices.map((notice) => (
                  <p key={notice} className="text-muted-foreground text-sm">
                    {SOURCE_NOTICE_COPY[notice] ?? notice}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onEnterManually(selectedDocumentId, document.data?.blocks ?? [])
                    }
                  >
                    <FileSearch />
                    Add a statement manually
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleExtract(selectedDocumentId)}
                    disabled={extract.isPending}
                  >
                    <Sparkles className={extract.isPending ? 'animate-pulse' : undefined} />
                    {extract.isPending ? 'Extracting…' : 'Propose statements'}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Proposals are suggestions only. Nothing is recorded until you accept it.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                This document has not been read yet, or no text could be extracted from it.
              </p>
            )}

            {extract.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  The extraction request failed. Nothing was recorded — retry, or add the
                  statement manually.
                </AlertDescription>
              </Alert>
            )}
            {extractionNote && (
              <p className="text-sm" data-testid="extraction-note">
                {extractionNote}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SourceRow({
  source,
  selected,
  busy,
  onSelect,
}: {
  source: SourceRefOut
  selected: boolean
  busy: boolean
  onSelect: () => void
}) {
  const label = source.description || source.filename

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="outline">{source.form_type}</Badge>
            {source.is_amendment && <Badge variant="secondary">Amendment</Badge>}
            {source.content_state === 'ready' && (
              <Badge variant="secondary">Loaded</Badge>
            )}
            {source.content_state === 'unavailable' && (
              <Badge variant="destructive">Could not be read</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {formatDate(source.source_date)} · {source.accession_number}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            SEC <ExternalLink className="size-3" />
          </a>
          {source.supported ? (
            <Button
              size="sm"
              variant={selected ? 'secondary' : 'outline'}
              onClick={onSelect}
              disabled={busy}
              aria-pressed={selected}
            >
              {busy ? 'Loading…' : selected ? 'Selected' : 'Select'}
            </Button>
          ) : (
            // Listing it is still useful: the reader gets the SEC link even
            // though this attachment type cannot be parsed here.
            <span className="text-muted-foreground text-xs">PDF — open on SEC</span>
          )}
        </div>
      </div>
    </li>
  )
}
