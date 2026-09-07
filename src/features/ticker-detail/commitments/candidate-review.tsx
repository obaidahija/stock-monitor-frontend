import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import {
  EVENT_KIND_LABELS,
  METRIC_LABELS,
  UNRESOLVED_FIELD_LABELS,
  type CandidateOut,
  type CandidateProposal,
  type CommitmentSummaryOut,
  type LifecycleKind,
  type MetricBasis,
  type MetricKey,
  type PeriodKind,
  type SourceBlock,
  type TargetOperator,
} from '@/types/management-commitments'
import { formatPeriod, unresolvedFields } from './format'
import {
  useCommitmentCandidates,
  useCreateManualCandidate,
  useReviewCommitmentCandidate,
} from './hooks'

const NEW_COMMITMENT = 'new'

const LIFECYCLE_KINDS: LifecycleKind[] = [
  'issued',
  'revised',
  'reaffirmed',
  'withdrawn',
  'reinstated',
  'actual',
]

function newRequestId() {
  return crypto.randomUUID()
}

interface CandidateReviewProps {
  ticker: string
  commitments: CommitmentSummaryOut[]
  manualEntry: { documentId: number; blocks: SourceBlock[] } | null
  onManualEntryClosed: () => void
}

/**
 * Review pending proposals and enter statements by hand.
 *
 * Two things are deliberate. The source quote sits beside the editable fields
 * rather than behind a disclosure, because a reviewer approving a number they
 * have not read against its source is the failure this whole feature exists to
 * prevent. And acceptance is disabled while any required field is unresolved,
 * with the missing fields named -- a proposal that could not establish a fiscal
 * period must not be acceptable just because it looks tidy.
 */
export function CandidateReview({
  ticker,
  commitments,
  manualEntry,
  onManualEntryClosed,
}: CandidateReviewProps) {
  const candidates = useCommitmentCandidates(ticker, {
    offset: 0,
    limit: 50,
    state: 'pending',
  })

  return (
    <div className="space-y-4">
      {manualEntry && (
        <ManualEntryForm
          ticker={ticker}
          documentId={manualEntry.documentId}
          blocks={manualEntry.blocks}
          onDone={onManualEntryClosed}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pending review</CardTitle>
          <CardDescription>
            Nothing here is recorded yet. Each proposal must be checked against its source
            passage before it becomes part of the ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {candidates.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : candidates.isError ? (
            <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />
          ) : candidates.data && candidates.data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No proposals are waiting. Select a source to add one manually or ask for
              proposals.
            </p>
          ) : (
            candidates.data?.items.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                ticker={ticker}
                candidate={candidate}
                commitments={commitments}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CandidateCard({
  ticker,
  candidate,
  commitments,
}: {
  ticker: string
  candidate: CandidateOut
  commitments: CommitmentSummaryOut[]
}) {
  const review = useReviewCommitmentCandidate(ticker)
  const [proposal, setProposal] = useState<CandidateProposal>(candidate.proposal)
  const [attachTo, setAttachTo] = useState<string>(
    candidate.suggested_commitment_ids.length > 0
      ? String(candidate.suggested_commitment_ids[0])
      : NEW_COMMITMENT,
  )
  const [note, setNote] = useState('')
  // The same request id is reused across a retry, so a network failure that
  // actually succeeded server-side replays instead of double-writing. A new id
  // is minted only when the reviewer changes what they are asking for.
  const [requestId, setRequestId] = useState(newRequestId)

  const edited = useMemo(
    () => JSON.stringify(proposal) !== JSON.stringify(candidate.proposal),
    [proposal, candidate.proposal],
  )
  const modelEdited = edited && candidate.origin === 'model'

  useEffect(() => {
    setRequestId(newRequestId())
  }, [attachTo, edited])

  const unresolved = unresolvedFields(proposal)
  const needsNote = modelEdited && note.trim().length === 0
  const canAccept = unresolved.length === 0 && !needsNote && !review.isPending

  // Rejections are caught rather than floated: the failure is already rendered
  // from the mutation's own state, and an unhandled rejection would surface as
  // an uncaught console error on every declined review.
  async function accept() {
    const existing = attachTo === NEW_COMMITMENT ? undefined : Number(attachTo)
    const target = commitments.find((c) => c.id === existing)
    await review
      .mutateAsync({
        candidateId: candidate.id,
        body: {
          action: 'accept',
          request_uuid: requestId,
          commitment_id: existing ?? null,
          expected_version: target ? target.version : null,
          proposal: edited ? proposal : null,
          note: note.trim() || null,
        },
      })
      .catch(() => undefined)
  }

  async function reject() {
    await review
      .mutateAsync({
        candidateId: candidate.id,
        body: { action: 'reject', request_uuid: requestId, note: note.trim() || null },
      })
      .catch(() => undefined)
  }

  const conflict = review.error instanceof ApiError && review.error.status === 409

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{EVENT_KIND_LABELS[proposal.kind]}</Badge>
        <Badge variant="secondary">
          {candidate.origin === 'model' ? 'Proposed by model' : 'Entered manually'}
        </Badge>
        {unresolved.length > 0 && <Badge variant="destructive">Incomplete</Badge>}
      </div>

      <EvidenceList proposal={proposal} />

      <ProposalFields proposal={proposal} onChange={setProposal} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`attach-${candidate.id}`}>Record against</Label>
          <Select value={attachTo} onValueChange={setAttachTo}>
            <SelectTrigger id={`attach-${candidate.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_COMMITMENT}>A new commitment</SelectItem>
              {commitments.map((commitment) => (
                <SelectItem key={commitment.id} value={String(commitment.id)}>
                  {METRIC_LABELS[commitment.identity.metric]} ·{' '}
                  {formatPeriod(commitment.identity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`note-${candidate.id}`}>
            Review note{modelEdited ? ' (required — you changed a proposed field)' : ''}
          </Label>
          <Textarea
            id={`note-${candidate.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </div>
      </div>

      {unresolved.length > 0 && (
        <Alert>
          <AlertDescription>
            This proposal cannot be accepted until these are supplied:{' '}
            {unresolved.map((field) => UNRESOLVED_FIELD_LABELS[field] ?? field).join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      {review.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {conflict
              ? 'This commitment changed while you were reviewing. Reload the ledger and check your edits before submitting again — nothing was recorded.'
              : 'The review could not be saved. Nothing was recorded; your edits are still here.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={accept} disabled={!canAccept}>
          Accept
        </Button>
        <Button variant="outline" onClick={reject} disabled={review.isPending}>
          Reject
        </Button>
      </div>
    </div>
  )
}

function EvidenceList({ proposal }: { proposal: CandidateProposal }) {
  if (proposal.evidence.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No source passage is attached.</p>
    )
  }
  return (
    <div className="space-y-2">
      {proposal.evidence.map((evidence, index) => (
        <blockquote
          key={`${evidence.block_id}-${index}`}
          className="border-border bg-muted/40 rounded-md border-l-2 px-3 py-2 text-sm"
        >
          <p className="italic">“{evidence.quote}”</p>
          <p className="text-muted-foreground mt-1 text-xs">Passage {evidence.block_id}</p>
        </blockquote>
      ))}
    </div>
  )
}

function ProposalFields({
  proposal,
  onChange,
}: {
  proposal: CandidateProposal
  onChange: (next: CandidateProposal) => void
}) {
  function set<K extends keyof CandidateProposal>(key: K, value: CandidateProposal[K]) {
    onChange({ ...proposal, [key]: value })
  }

  function setTarget(patch: Partial<NonNullable<CandidateProposal['target']>>) {
    const current = proposal.target ?? { operator: 'range' as TargetOperator, lower: null, upper: null }
    onChange({ ...proposal, target: { ...current, ...patch } })
  }

  const isActual = proposal.kind === 'actual'
  const needsTarget = ['issued', 'revised', 'reinstated'].includes(proposal.kind)

  function changeKind(kind: LifecycleKind) {
    const targetKind = ['issued', 'revised', 'reinstated'].includes(kind)
    onChange({
      ...proposal,
      kind,
      target: targetKind
        ? proposal.target ?? { operator: 'range', lower: null, upper: null }
        : null,
      actual_value: kind === 'actual' ? proposal.actual_value : null,
      actual_basis: kind === 'actual' ? proposal.actual_basis : null,
      actual_definition: kind === 'actual' ? proposal.actual_definition : null,
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Statement kind" htmlFor="kind">
        <Select
          value={proposal.kind}
          onValueChange={(value) => changeKind(value as LifecycleKind)}
        >
          <SelectTrigger id="kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIFECYCLE_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {EVENT_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Metric" htmlFor="metric">
        <Select
          value={proposal.metric}
          onValueChange={(value) => set('metric', value as MetricKey)}
        >
          <SelectTrigger id="metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((metric) => (
              <SelectItem key={metric} value={metric}>
                {METRIC_LABELS[metric]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Accounting basis" htmlFor="basis">
        <Select
          value={proposal.basis}
          onValueChange={(value) => set('basis', value as MetricBasis)}
        >
          <SelectTrigger id="basis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gaap">GAAP</SelectItem>
            <SelectItem value="non_gaap">Non-GAAP</SelectItem>
            <SelectItem value="unspecified">Not stated</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Period type" htmlFor="period_kind">
        <Select
          value={proposal.period_kind ?? ''}
          onValueChange={(value) => set('period_kind', value as PeriodKind)}
        >
          <SelectTrigger id="period_kind">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {/*
        Dates are entered explicitly and are never defaulted from the filing
        date: a source's filing date is not the target's period end, and
        pre-filling one would look like evidence.
      */}
      <Field label="Fiscal period start" htmlFor="period_start">
        <Input
          id="period_start"
          type="date"
          value={proposal.period_start ?? ''}
          onChange={(event) => set('period_start', event.target.value || null)}
        />
      </Field>

      <Field label="Fiscal period end" htmlFor="period_end">
        <Input
          id="period_end"
          type="date"
          value={proposal.period_end ?? ''}
          onChange={(event) => set('period_end', event.target.value || null)}
        />
      </Field>

      <Field label="Statement date" htmlFor="statement_date">
        <Input
          id="statement_date"
          type="date"
          value={proposal.statement_date ?? ''}
          onChange={(event) => set('statement_date', event.target.value || null)}
        />
      </Field>

      <Field label="Currency" htmlFor="currency">
        <Input
          id="currency"
          value={proposal.currency ?? ''}
          placeholder={proposal.metric === 'revenue' ? 'USD' : 'Not used for margins'}
          disabled={proposal.metric !== 'revenue'}
          onChange={(event) => set('currency', event.target.value.toUpperCase() || null)}
        />
      </Field>

      {isActual ? (
        <Field label="Reported result" htmlFor="actual_value">
          <Input
            id="actual_value"
            inputMode="decimal"
            value={proposal.actual_value ?? ''}
            onChange={(event) => set('actual_value', event.target.value || null)}
          />
        </Field>
      ) : needsTarget ? (
        <>
          <Field label="Target shape" htmlFor="operator">
            <Select
              value={proposal.target?.operator ?? 'range'}
              onValueChange={(value) => setTarget({ operator: value as TargetOperator })}
            >
              <SelectTrigger id="operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="range">Range</SelectItem>
                <SelectItem value="eq">Single figure</SelectItem>
                <SelectItem value="gte">At least</SelectItem>
                <SelectItem value="lte">No more than</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Lower bound" htmlFor="lower">
            <Input
              id="lower"
              inputMode="decimal"
              value={proposal.target?.lower ?? ''}
              onChange={(event) => setTarget({ lower: event.target.value || null })}
            />
          </Field>

          <Field label="Upper bound" htmlFor="upper">
            <Input
              id="upper"
              inputMode="decimal"
              value={proposal.target?.upper ?? ''}
              onChange={(event) => setTarget({ upper: event.target.value || null })}
            />
          </Field>
        </>
      ) : null}

      <Field label="Adjustments or conditions" htmlFor="definition" full>
        <Input
          id="definition"
          value={proposal.definition}
          placeholder="As stated by the issuer, if any"
          onChange={(event) => set('definition', event.target.value)}
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string
  htmlFor: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ManualEntryForm({
  ticker,
  documentId,
  blocks,
  onDone,
}: {
  ticker: string
  documentId: number
  blocks: SourceBlock[]
  onDone: () => void
}) {
  const create = useCreateManualCandidate(ticker)
  const [blockId, setBlockId] = useState(blocks[0]?.block_id ?? '')
  const [quote, setQuote] = useState('')
  const [proposal, setProposal] = useState<CandidateProposal>(emptyProposal())

  const block = blocks.find((b) => b.block_id === blockId)
  const start = block && quote ? block.text.indexOf(quote) : -1
  const quoteFound = start >= 0 && quote.length > 0
  const unresolved = unresolvedFields(proposal)

  async function submit() {
    if (!block || !quoteFound) return
    try {
      await create.mutateAsync({
        document_id: documentId,
        proposal: {
          ...proposal,
          evidence: [{ block_id: block.block_id, start, end: start + quote.length, quote }],
        },
      })
    } catch {
      // Rendered from the mutation's error state; the entry stays on screen.
      return
    }
    onDone()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a statement manually</CardTitle>
        <CardDescription>
          Select the passage this statement comes from and paste the exact wording. No AI
          provider is involved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Source passage" htmlFor="manual-block" full>
          <Select value={blockId} onValueChange={setBlockId}>
            <SelectTrigger id="manual-block">
              <SelectValue placeholder="Select a passage" />
            </SelectTrigger>
            <SelectContent>
              {blocks.map((candidate) => (
                <SelectItem key={candidate.block_id} value={candidate.block_id}>
                  {candidate.text.slice(0, 90)}
                  {candidate.text.length > 90 ? '…' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {block && (
          <blockquote className="border-border bg-muted/40 rounded-md border-l-2 px-3 py-2 text-sm">
            {block.text}
          </blockquote>
        )}

        <Field label="Exact quotation from that passage" htmlFor="manual-quote" full>
          <Textarea
            id="manual-quote"
            rows={2}
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
          />
        </Field>
        {quote.length > 0 && !quoteFound && (
          <Alert variant="destructive">
            <AlertDescription>
              That wording does not appear in the selected passage. Evidence has to be the
              issuer's exact words.
            </AlertDescription>
          </Alert>
        )}

        <ProposalFields proposal={proposal} onChange={setProposal} />

        {create.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              The statement could not be saved. Nothing was recorded.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={submit}
            disabled={!quoteFound || unresolved.length > 0 || create.isPending}
          >
            Save for review
          </Button>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {unresolved.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Still needed:{' '}
            {unresolved.map((field) => UNRESOLVED_FIELD_LABELS[field] ?? field).join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function emptyProposal(): CandidateProposal {
  return {
    kind: 'issued',
    metric: 'revenue',
    basis: 'unspecified',
    scope: 'consolidated',
    currency: null,
    unit: null,
    period_start: null,
    period_end: null,
    period_kind: null,
    fiscal_label: null,
    definition: '',
    statement_date: null,
    target: { operator: 'range', lower: null, upper: null },
    actual_value: null,
    actual_basis: null,
    actual_definition: null,
    evidence: [],
    model_note: null,
  }
}
