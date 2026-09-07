import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-client'
import {
  EVENT_KIND_LABELS,
  type CommitmentDetailOut,
  type EventKind,
  type EventPayload,
  type EvidenceRef,
  type LifecycleKind,
  type TargetOperator,
} from '@/types/management-commitments'
import { formatDate } from './format'
import { useAppendCommitmentEvent, useArchiveCommitment } from './hooks'

const TARGET_KINDS: LifecycleKind[] = ['issued', 'revised', 'reinstated']
const KIND_OPTIONS: EventKind[] = [
  'revised',
  'reaffirmed',
  'withdrawn',
  'reinstated',
  'actual',
  'correction',
]

function newRequestId() {
  return crypto.randomUUID()
}

/**
 * Record a lifecycle event, correct an earlier one, or archive the commitment.
 *
 * Evidence is never authored here: the form reuses a saved `EvidenceRef` from
 * an existing event, so a new record always points at source text that was
 * already verified against the stored document. A correction additionally
 * requires selecting the specific record it replaces and supplying a note.
 *
 * The request id survives a retry and is regenerated only when the user starts
 * a materially different mutation. On a 409 the input is kept on screen for the
 * user to re-check -- it is never silently resubmitted against a version that
 * moved underneath it.
 */
export function CommitmentEventForm({
  ticker,
  commitment,
}: {
  ticker: string
  commitment: CommitmentDetailOut
}) {
  const append = useAppendCommitmentEvent(ticker)
  const archive = useArchiveCommitment(ticker)

  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<EventKind>('revised')
  const [statementDate, setStatementDate] = useState('')
  const [operator, setOperator] = useState<TargetOperator>('range')
  const [lower, setLower] = useState('')
  const [upper, setUpper] = useState('')
  const [actualValue, setActualValue] = useState('')
  const [supersedesId, setSupersedesId] = useState<string>('')
  const [evidenceEventId, setEvidenceEventId] = useState<string>('')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState(newRequestId)

  const [archiveReason, setArchiveReason] = useState('')
  const [archiveRequestId, setArchiveRequestId] = useState(newRequestId)

  const eventsWithEvidence = commitment.events.filter((e) => e.payload.evidence.length > 0)

  useEffect(() => {
    // A different kind or a different corrected record is a materially new
    // mutation, so it gets its own id. Retrying the same one must not.
    setRequestId(newRequestId())
  }, [kind, supersedesId])

  useEffect(() => {
    if (evidenceEventId === '' && eventsWithEvidence.length > 0) {
      setEvidenceEventId(String(eventsWithEvidence[0].id))
    }
  }, [evidenceEventId, eventsWithEvidence])

  const evidence: EvidenceRef[] =
    commitment.events.find((e) => String(e.id) === evidenceEventId)?.payload.evidence ?? []

  const correctionTarget = commitment.events.find((e) => String(e.id) === supersedesId)
  const replacementKind: LifecycleKind | undefined = kind === 'correction'
    ? correctionTarget?.payload.kind
    : kind
  const needsTarget = replacementKind !== undefined && TARGET_KINDS.includes(replacementKind)
  const isActual = replacementKind === 'actual'

  function selectCorrection(eventId: string) {
    setSupersedesId(eventId)
    const selected = commitment.events.find((event) => String(event.id) === eventId)
    if (!selected) return
    setStatementDate(selected.payload.statement_date)
    setOperator(selected.payload.target?.operator ?? 'range')
    setLower(selected.payload.target?.lower ?? '')
    setUpper(selected.payload.target?.upper ?? '')
    setActualValue(selected.payload.actual_value ?? '')
    setEvidenceEventId(eventId)
  }

  const missing: string[] = []
  if (!statementDate) missing.push('a statement date')
  if (evidence.length === 0) missing.push('a source passage')
  if (isActual && !actualValue) missing.push('a reported result')
  if (kind === 'correction') {
    if (!supersedesId) missing.push('the record being corrected')
    if (!note.trim()) missing.push('a correction note')
  }
  if (needsTarget && !lower && !upper) missing.push('a target')

  function payload(): EventPayload {
    const wantsTarget =
      replacementKind === 'issued' ||
      replacementKind === 'revised' ||
      replacementKind === 'reinstated'
    return {
      kind: replacementKind ?? 'issued',
      statement_date: statementDate,
      evidence,
      target:
        wantsTarget && (lower || upper)
          ? { operator, lower: lower || null, upper: upper || null }
          : null,
      actual_value: replacementKind === 'actual' ? actualValue || null : null,
      actual_basis: kind === 'correction' ? correctionTarget?.payload.actual_basis ?? null : null,
      actual_definition: kind === 'correction' ? correctionTarget?.payload.actual_definition ?? null : null,
      note: kind === 'correction' ? correctionTarget?.payload.note ?? null : null,
    }
  }

  async function submit() {
    try {
      await append.mutateAsync({
        commitmentId: commitment.id,
        body: {
          request_uuid: requestId,
          expected_version: commitment.version,
          event: {
            kind,
            payload: payload(),
            supersedes_event_id: kind === 'correction' ? Number(supersedesId) : null,
            note: note.trim() || null,
          },
        },
      })
    } catch {
      // The conflict message is rendered from the mutation's error state and
      // the entry stays on screen. Holding the same request id means a retry
      // replays rather than double-writing.
      return
    }
    setOpen(false)
    setRequestId(newRequestId())
  }

  async function toggleArchive() {
    try {
      await archive.mutateAsync({
        commitmentId: commitment.id,
        body: {
          request_uuid: archiveRequestId,
          expected_version: commitment.version,
          archived: !commitment.archived,
          reason: archiveReason.trim(),
        },
      })
    } catch {
      return
    }
    setArchiveReason('')
    setArchiveRequestId(newRequestId())
  }

  const conflict = append.error instanceof ApiError && append.error.status === 409

  return (
    <section className="border-border space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? 'Cancel' : 'Record a statement'}
        </Button>
        <span className="text-muted-foreground text-xs">Version {commitment.version}</span>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="event-kind">Statement kind</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as EventKind)}>
                <SelectTrigger id="event-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {EVENT_KIND_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="event-date">Statement date</Label>
              <Input
                id="event-date"
                type="date"
                value={statementDate}
                onChange={(event) => setStatementDate(event.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="event-evidence">Source passage</Label>
              <Select value={evidenceEventId} onValueChange={setEvidenceEventId}>
                <SelectTrigger id="event-evidence">
                  <SelectValue placeholder="Select saved evidence" />
                </SelectTrigger>
                <SelectContent>
                  {eventsWithEvidence.map((event) => (
                    <SelectItem key={event.id} value={String(event.id)}>
                      {formatDate(event.payload.statement_date)} —{' '}
                      {event.payload.evidence[0].quote.slice(0, 70)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Reuses evidence already verified against the saved source document.
              </p>
            </div>

            {kind === 'correction' && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="event-supersedes">Record being corrected</Label>
                <Select value={supersedesId} onValueChange={selectCorrection}>
                  <SelectTrigger id="event-supersedes">
                    <SelectValue placeholder="Select a record" />
                  </SelectTrigger>
                  <SelectContent>
                    {commitment.events
                      .filter((event) => event.superseded_by_event_id === null)
                      .map((event) => (
                        <SelectItem key={event.id} value={String(event.id)}>
                          #{event.id} {EVENT_KIND_LABELS[event.kind]} —{' '}
                          {formatDate(event.payload.statement_date)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isActual ? (
              <div className="space-y-1">
                <Label htmlFor="event-actual">Reported result</Label>
                <Input
                  id="event-actual"
                  inputMode="decimal"
                  value={actualValue}
                  onChange={(event) => setActualValue(event.target.value)}
                />
              </div>
            ) : needsTarget ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="event-operator">Target shape</Label>
                  <Select
                    value={operator}
                    onValueChange={(value) => setOperator(value as TargetOperator)}
                  >
                    <SelectTrigger id="event-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="range">Range</SelectItem>
                      <SelectItem value="eq">Single figure</SelectItem>
                      <SelectItem value="gte">At least</SelectItem>
                      <SelectItem value="lte">No more than</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-lower">Lower bound</Label>
                  <Input
                    id="event-lower"
                    inputMode="decimal"
                    value={lower}
                    onChange={(event) => setLower(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-upper">Upper bound</Label>
                  <Input
                    id="event-upper"
                    inputMode="decimal"
                    value={upper}
                    onChange={(event) => setUpper(event.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="event-note">
                Note{kind === 'correction' ? ' (required for a correction)' : ''}
              </Label>
              <Textarea
                id="event-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          {append.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {conflict
                  ? 'This commitment changed while you were editing. Nothing was recorded — reload the history, check your entry against the current version, and submit again.'
                  : 'The statement could not be recorded. Nothing was saved and your entry is still here.'}
              </AlertDescription>
            </Alert>
          )}

          {missing.length > 0 && (
            <p className="text-muted-foreground text-sm">Still needed: {missing.join(', ')}.</p>
          )}

          <Button onClick={submit} disabled={missing.length > 0 || append.isPending}>
            Record statement
          </Button>
        </div>
      )}

      <div className="border-border space-y-2 border-t pt-3">
        <Label htmlFor="archive-reason">
          {commitment.archived ? 'Reason for restoring' : 'Reason for archiving'}
        </Label>
        <Input
          id="archive-reason"
          value={archiveReason}
          onChange={(event) => setArchiveReason(event.target.value)}
          placeholder="Required — history is preserved either way"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={toggleArchive}
          disabled={!archiveReason.trim() || archive.isPending}
        >
          {commitment.archived ? 'Restore' : 'Archive'}
        </Button>
        {archive.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {archive.error instanceof ApiError && archive.error.status === 409
                ? 'This commitment changed while you were editing. Nothing was changed — reload and try again.'
                : 'The change could not be saved. Nothing was changed.'}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  )
}
