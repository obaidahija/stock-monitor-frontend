import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FILING_SECTION_LABELS } from '@/types/filing-changes'
import type {
  FilingChangeOut,
  FilingDiffSpan,
  FilingReferenceOut,
} from '@/types/filing-changes'

const KIND_LABEL: Record<FilingChangeOut['kind'], string> = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Modified',
}

/** Long passages collapse to this many characters until expanded. */
const COLLAPSE_CHARS = 700

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

/**
 * Renders one side's spans. Changed runs are wrapped in <del>/<mark> so the
 * difference is carried by semantic markup and not by colour alone, and every
 * span is plain text rendered by React -- source wording is never injected as
 * HTML.
 */
function PassageText({ spans, side }: { spans: FilingDiffSpan[]; side: 'before' | 'after' }) {
  return (
    <>
      {spans.map((span, index) =>
        span.changed ? (
          side === 'before' ? (
            <del
              key={index}
              className="bg-destructive/15 text-foreground rounded-sm px-0.5 decoration-2"
            >
              {span.text}
            </del>
          ) : (
            <mark key={index} className="bg-primary/20 text-foreground rounded-sm px-0.5">
              {span.text}
            </mark>
          )
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  )
}

/**
 * Truncate for display while keeping span structure, so a collapsed passage
 * still shows which words changed rather than degrading to flat text.
 */
function sliceSpans(spans: FilingDiffSpan[], maxChars: number): FilingDiffSpan[] {
  const kept: FilingDiffSpan[] = []
  let used = 0
  for (const span of spans) {
    if (used >= maxChars) break
    const remaining = maxChars - used
    kept.push(
      span.text.length <= remaining
        ? span
        : { text: `${span.text.slice(0, remaining)}…`, changed: span.changed },
    )
    used += span.text.length
  }
  return kept
}

function PassageColumn({
  label,
  side,
  reference,
  spans,
  missingCopy,
}: {
  label: string
  side: 'before' | 'after'
  reference: FilingReferenceOut
  spans: FilingDiffSpan[]
  missingCopy: string
}) {
  const [expanded, setExpanded] = useState(false)
  const length = spans.reduce((total, span) => total + span.text.length, 0)
  const isLong = length > COLLAPSE_CHARS
  const visible = isLong && !expanded ? sliceSpans(spans, COLLAPSE_CHARS) : spans

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="text-muted-foreground text-xs">
        <span className="font-medium">{label}</span>{' '}
        <span>
          FY ending {formatDate(reference.report_date)} · filed{' '}
          {formatDate(reference.filed_date)}
        </span>
        <a
          href={reference.filing_url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground ml-2 underline"
        >
          SEC document
        </a>
      </div>
      {spans.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border border-dashed p-3 text-sm italic">
          {missingCopy}
        </p>
      ) : (
        <div className="bg-muted/40 rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap">
          <p>
            <PassageText spans={visible} side={side} />
          </p>
          {isLong && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Show less' : 'Show full passage'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function FilingChangeCard({
  change,
  before,
  after,
}: {
  change: FilingChangeOut
  before: FilingReferenceOut
  after: FilingReferenceOut
}) {
  const heading = change.after?.heading ?? change.before?.heading ?? null

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{KIND_LABEL[change.kind]}</Badge>
        <span className="text-muted-foreground text-xs">
          {FILING_SECTION_LABELS[change.section]}
        </span>
        {heading && <span className="text-xs font-medium">{heading}</span>}
        {change.routine_date_update && <Badge variant="outline">Routine date update</Badge>}
        {change.alignment_confidence === 'low' && (
          <Badge variant="outline">Possible unmatched passage—review source</Badge>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <PassageColumn
          label="Earlier"
          side="before"
          reference={before}
          spans={change.before_spans}
          missingCopy="No matched passage in this section"
        />
        <PassageColumn
          label="Later"
          side="after"
          reference={after}
          spans={change.after_spans}
          missingCopy="No matched passage in this section"
        />
      </div>

      {change.annotation && (
        // Kept below the quotations and labelled, so a generated note is never
        // mistaken for filing text.
        <div className="border-border space-y-1 rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs font-medium">AI explanation</p>
          <p className="text-sm">{change.annotation.explanation}</p>
          {change.annotation.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {change.annotation.topics.map((topic) => (
                <Badge key={topic} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
