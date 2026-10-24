import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteResearchArchive, getResearchArchive, previewResearchArchive } from '@/api/research-archive'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api-client'
import type { ResearchArchiveCount, ResearchArchivePreview, ResearchArchiveSelection } from '@/types/research-archive'

const ARCHIVE_KEY = ['research-archive'] as const
const RESEARCH_QUERY_ROOTS = new Set([
  'research-archive', 'research-first', 'discover', 'catalysts', 'stocks', 'universe-score', 'analysis',
  'ai-research', 'follow-through', 'google-finance-market-picks', 'google-finance-competitors',
  'market-events', 'macro', 'stock-pairs', 'pair-strategy', 'pair-backtest', 'watchlists',
  'setup-window', 'digest', 'trending', 'twitter', 'reddit',
  'event-window', 'setup-event-window', 'research-subscriptions',
])
const SYSTEM_RESEARCH_QUERIES = new Set([
  'research-performance', 'research-monitoring', 'research-observations', 'signal-performance',
])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const expiryFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
})

interface PreviewRequest {
  selection: ResearchArchiveSelection
  revision: number
}

interface ReviewedPreview {
  data: ResearchArchivePreview
  revision: number
}

function cleanupError(error: unknown) {
  const detail = error instanceof ApiError ? error.detail : null
  const code = typeof detail === 'object' && detail !== null && 'code' in detail ? detail.code : detail
  switch (code) {
    case 'preview_expired': return 'Preview expired. Preview cleanup again.'
    case 'preview_changed': return 'Saved research changed since the preview. Preview cleanup again to review the current counts.'
    case 'invalid_preview': return 'This preview is no longer valid. Preview cleanup again.'
    case 'narrow_range': return 'Choose a smaller date range, then preview cleanup again.'
    default: return 'Could not complete cleanup. Preview cleanup again before trying to delete.'
  }
}

function RecordCounts({ counts, label, deletion = false }: {
  counts: ResearchArchiveCount[]
  label: string
  deletion?: boolean
}) {
  return (
    <Table aria-label={label} className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Saved records</TableHead>
          <TableHead className="w-24 text-right">{deletion ? 'To delete' : 'Stored'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {counts.map((count) => (
          <TableRow key={count.key}>
            <TableCell className="whitespace-normal break-words">{count.label}</TableCell>
            <TableCell className="text-right tabular-nums">{count.count.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function ResearchArchivePanel() {
  const queryClient = useQueryClient()
  const archive = useQuery({ queryKey: ARCHIVE_KEY, queryFn: getResearchArchive, retry: false })
  const [selection, setSelection] = useState<ResearchArchiveSelection>({ kind: '', date_from: '', date_to: '' })
  const [reviewed, setReviewed] = useState<ReviewedPreview | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // A revision also rejects a response when filters changed away and then back.
  const revision = useRef(0)
  const deleteInFlight = useRef(false)

  function discardReview() {
    revision.current += 1
    setReviewed(null)
    setConfirmation('')
  }

  const previewMutation = useMutation({
    mutationFn: (request: PreviewRequest) => previewResearchArchive(request.selection),
    retry: false,
    onSuccess: (data, request) => {
      if (request.revision !== revision.current) return
      if (data.kind !== request.selection.kind || data.date_from !== request.selection.date_from ||
          data.date_to !== request.selection.date_to || !data.token || !Number.isFinite(Date.parse(data.expires_at))) {
        discardReview()
        setError('The preview did not match this selection. Preview cleanup again.')
      } else if (Date.parse(data.expires_at) <= Date.now()) {
        discardReview()
        setError('Preview expired. Preview cleanup again.')
      } else {
        setReviewed({ data, revision: request.revision })
      }
    },
    onError: (failure, request) => {
      if (request.revision !== revision.current) return
      discardReview()
      setError(cleanupError(failure))
    },
  })
  const { reset: resetPreview } = previewMutation

  function refreshResearch() {
    void queryClient.invalidateQueries({
      predicate: (query) => RESEARCH_QUERY_ROOTS.has(String(query.queryKey[0])) ||
        (query.queryKey[0] === 'system' && SYSTEM_RESEARCH_QUERIES.has(String(query.queryKey[1]))),
    })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteResearchArchive,
    retry: false,
    onSuccess: (result) => {
      discardReview()
      setError(null)
      setSuccess(`${result.total_records.toLocaleString()} records deleted from the reviewed selection.`)
      refreshResearch()
    },
    onError: (failure) => {
      discardReview()
      setError(cleanupError(failure))
      // A failed response can follow a completed server transaction; read fresh counts.
      refreshResearch()
    },
    onSettled: () => { deleteInFlight.current = false },
  })

  useEffect(() => {
    if (archive.isError) {
      revision.current += 1
      setReviewed(null)
      setConfirmation('')
      resetPreview()
    }
  }, [archive.isError, resetPreview])

  useEffect(() => {
    if (!reviewed) return
    const timer = window.setTimeout(() => {
      if (reviewed.revision !== revision.current) return
      discardReview()
      setError('Preview expired. Preview cleanup again.')
    }, Math.max(0, Date.parse(reviewed.data.expires_at) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [reviewed])

  const collections = archive.data?.collections ?? []
  const selectedCollection = collections.find((collection) => collection.kind === selection.kind)
  const reversedRange = Boolean(selection.date_from && selection.date_to && selection.date_from > selection.date_to)
  const validSelection = Boolean(selectedCollection && DATE_PATTERN.test(selection.date_from) &&
    DATE_PATTERN.test(selection.date_to) && !reversedRange && !archive.isError)
  const preview = reviewed?.data
  const canDelete = Boolean(preview && reviewed.revision === revision.current &&
    preview.total_records > 0 && Date.parse(preview.expires_at) > Date.now() &&
    confirmation === 'DELETE' && validSelection && !deleteMutation.isPending)

  function changeSelection(change: Partial<ResearchArchiveSelection>) {
    if (deleteInFlight.current) return
    discardReview()
    resetPreview()
    setError(null)
    setSuccess(null)
    setSelection((current) => ({ ...current, ...change }))
  }

  function requestPreview() {
    if (!validSelection || previewMutation.isPending || deleteInFlight.current) return
    discardReview()
    setError(null)
    setSuccess(null)
    previewMutation.mutate({ selection: { ...selection }, revision: revision.current })
  }

  function requestDeletion() {
    if (!preview || deleteInFlight.current) return
    // Recheck the clock at the click, including when a background tab delayed the timer.
    if (Date.parse(preview.expires_at) <= Date.now()) {
      discardReview()
      setError('Preview expired. Preview cleanup again.')
      return
    }
    if (!canDelete) return
    deleteInFlight.current = true
    setSuccess(null)
    deleteMutation.mutate({ token: preview.token, confirmation: 'DELETE' })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Saved research</h2>
        <p className="text-muted-foreground text-sm">
          Saved research has no automatic expiry. Manual cleanup removes only a reviewed selection.
          Some reports contain only their currently stored version.
        </p>
      </div>

      {archive.isPending && <p role="status" className="text-muted-foreground text-sm">Loading saved research…</p>}
      {archive.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>Could not load saved research. Any previous cleanup preview has been cleared.</p>
            <Button variant="outline" size="sm" onClick={() => void archive.refetch()}>Retry loading</Button>
          </AlertDescription>
        </Alert>
      )}

      {archive.data && (
        <>
          {collections.length === 0 && <p className="text-muted-foreground text-sm">No saved research collections are available.</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <Card key={collection.kind} role="region" aria-label={collection.label}>
                <CardHeader>
                  <CardTitle><h3>{collection.label}</h3></CardTitle>
                  <CardDescription>{collection.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Badge variant="secondary" className="self-start">
                    {collection.retention === 'latest_only' ? 'Current report only' : 'Kept until manual cleanup'}
                  </Badge>
                  {collection.retention === 'latest_only' && (
                    <p className="text-muted-foreground text-sm">
                      Only the currently stored report is available; previous versions are not retained.
                    </p>
                  )}
                  <RecordCounts counts={collection.counts} label={`${collection.label} stored counts`} />
                  <p>{collection.total_records.toLocaleString()} total records</p>
                  <p className="text-muted-foreground text-xs">
                    {collection.first_date && collection.last_date
                      ? `Saved dates: ${collection.first_date} through ${collection.last_date} (New York)`
                      : 'No saved dates'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle><h3>Manual cleanup</h3></CardTitle>
              <CardDescription>Choose one research collection and both saved dates before previewing cleanup.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
              <FieldGroup className="sm:grid sm:grid-cols-3 sm:gap-4">
                <Field data-disabled={deleteMutation.isPending}>
                  <FieldLabel htmlFor="archive-collection">Research collection</FieldLabel>
                  <Select value={selection.kind} disabled={deleteMutation.isPending || archive.isError} onValueChange={(kind) => changeSelection({ kind })}>
                    <SelectTrigger id="archive-collection" className="w-full"><SelectValue placeholder="Choose a collection" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {collections.map((collection) => (
                          <SelectItem key={collection.kind} value={collection.kind}>{collection.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-disabled={deleteMutation.isPending}>
                  <FieldLabel htmlFor="archive-date-from">Saved from (New York)</FieldLabel>
                  <Input id="archive-date-from" type="date" required value={selection.date_from} disabled={deleteMutation.isPending}
                    onChange={(event) => changeSelection({ date_from: event.target.value })} />
                </Field>
                <Field data-disabled={deleteMutation.isPending} data-invalid={reversedRange}>
                  <FieldLabel htmlFor="archive-date-to">Saved through (New York)</FieldLabel>
                  <Input id="archive-date-to" type="date" required value={selection.date_to} disabled={deleteMutation.isPending}
                    aria-invalid={reversedRange} aria-describedby={reversedRange ? 'archive-range-error' : undefined}
                    onChange={(event) => changeSelection({ date_to: event.target.value })} />
                  {reversedRange && <FieldError id="archive-range-error">The end date must be on or after the start date.</FieldError>}
                </Field>
              </FieldGroup>
              <p className="text-muted-foreground text-sm">Both dates are inclusive, using the saved date in New York.</p>
              <Button type="button" variant="outline" disabled={!validSelection || previewMutation.isPending || deleteMutation.isPending} onClick={requestPreview}>
                {previewMutation.isPending ? 'Previewing…' : 'Preview cleanup'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {error && !archive.isError && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <p role="status" className="text-sm">{success}</p>}

      {preview && !archive.isError && (
        <Card role="region" aria-label="Cleanup preview">
          <CardHeader>
            <CardTitle><h3>Cleanup preview</h3></CardTitle>
            <CardDescription>{preview.label}: {preview.date_from} through {preview.date_to}, inclusive saved dates in New York.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <RecordCounts counts={preview.counts} label="Reviewed cleanup counts" deletion />
            <p>{preview.total_records.toLocaleString()} records to delete.</p>
            <p>{preview.protected_records.toLocaleString()} active {preview.protected_records === 1 ? 'record is' : 'records are'} protected and excluded from deletion.</p>
            <p className="text-muted-foreground text-sm">Saved watchlist entries are kept; their links to deleted research are cleared.</p>
            <p className="text-muted-foreground text-sm">
              Preview valid until <time dateTime={preview.expires_at}>{expiryFormatter.format(new Date(preview.expires_at))}</time> (New York).
            </p>
            {preview.total_records === 0 ? (
              <p className="text-muted-foreground text-sm">No records to delete in this selection.</p>
            ) : (
              <>
                <FieldGroup className="max-w-sm">
                  <Field data-disabled={deleteMutation.isPending}>
                    <FieldLabel htmlFor="archive-confirmation">Type DELETE to confirm</FieldLabel>
                    <Input id="archive-confirmation" autoComplete="off" spellCheck={false} value={confirmation} disabled={deleteMutation.isPending}
                      aria-describedby="archive-confirmation-description" onChange={(event) => setConfirmation(event.target.value)} />
                    <FieldDescription id="archive-confirmation-description">This permanently removes the reviewed saved research.</FieldDescription>
                  </Field>
                </FieldGroup>
                <Button type="button" variant="destructive" disabled={!canDelete} onClick={requestDeletion}>
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete reviewed records'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
