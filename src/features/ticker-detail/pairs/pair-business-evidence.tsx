import { Badge } from '@/components/ui/badge'
import { formatDate, formatEasternDateTime } from '@/lib/format'
import type {
  StockPairBusinessClaimOut,
  StockPairBusinessEvidenceOut,
  StockPairBusinessStatus,
  StockPairClaimCheckStatus,
} from '@/types/api'

// Evidence-coverage labels: a passage was located and attributed, never that
// Google's reading of it, or the pair itself, has been confirmed.
const COVERAGE: Record<
  StockPairBusinessStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  source_checked: { label: 'Source passage checked', variant: 'secondary' },
  partial: { label: 'Source passage partly checked', variant: 'outline' },
  unverified: { label: 'No source passage confirmed', variant: 'outline' },
}

const CHECK: Record<StockPairClaimCheckStatus, string> = {
  matched: 'Found on the page',
  mismatch: 'Not found as quoted',
  unavailable: 'Source could not be retrieved',
  not_checked: 'Not checked',
}

const NOT_CHECKED = 'Not independently checked; refresh to check sources'

/** The address when it is an ordinary web page; anything else is never a link. */
function webAddress(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

function SourceCitation({ claim }: { claim: StockPairBusinessClaimOut }) {
  const href = webAddress(claim.source.url)
  return (
    <p className="text-xs">
      Source:{' '}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {claim.source.title}
        </a>
      ) : (
        <span>{claim.source.title}</span>
      )}
      {claim.source.publisher && (
        <span className="text-muted-foreground"> · {claim.source.publisher}</span>
      )}
    </p>
  )
}

function ClaimDates({ claim }: { claim: StockPairBusinessClaimOut }) {
  return (
    <div className="text-muted-foreground space-y-0.5 text-xs">
      {claim.reported_source_date && (
        <p>Date reported by Google Finance: {formatDate(claim.reported_source_date)}</p>
      )}
      {claim.source_published_at && (
        <p>Page&apos;s own publication date: {formatDate(claim.source_published_at.slice(0, 10))}</p>
      )}
      {claim.checked_at && (
        <p>
          Retrieved: <time dateTime={claim.checked_at}>{formatEasternDateTime(claim.checked_at)}</time>
        </p>
      )}
    </div>
  )
}

function Passage({ caption, text }: { caption: string; text: string }) {
  return (
    <figure className="space-y-0.5">
      <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
      <blockquote className="border-border border-l-2 pl-2 text-sm italic">“{text}”</blockquote>
    </figure>
  )
}

function ClaimItem({ claim }: { claim: StockPairBusinessClaimOut }) {
  const subject = claim.subject === 'BOTH' ? 'Both companies' : claim.subject
  return (
    <li className="border-border space-y-1.5 rounded-md border p-2">
      <p>
        <span className="font-medium">{subject}:</span> {claim.fact}
      </p>
      <p className="text-muted-foreground text-xs">Proposed by Google Finance</p>
      <Passage caption="Quoted by Google Finance" text={claim.proposed_excerpt} />
      <p className="text-xs">
        <span className="font-medium">{CHECK[claim.check_status]}</span>
        {claim.reason && (
          <>
            {' '}
            <span className="text-muted-foreground">{claim.reason}</span>
          </>
        )}
      </p>
      {claim.check_status === 'matched' && claim.checked_excerpt && (
        <Passage caption="Passage on the retrieved page" text={claim.checked_excerpt} />
      )}
      <SourceCitation claim={claim} />
      <ClaimDates claim={claim} />
    </li>
  )
}

/**
 * Google's proposed business connection, kept apart from what an independent
 * retrieval of each cited page found. Never changes or explains the numerical
 * strength.
 */
export function PairBusinessEvidence({
  evidence,
  explanation,
}: {
  evidence: StockPairBusinessEvidenceOut | null
  explanation: string
}) {
  const hypothesis = evidence?.hypothesis || explanation
  if (!evidence) {
    return (
      <div className="space-y-1 text-sm">
        {hypothesis && <p>Google Finance: {hypothesis}</p>}
        <p className="text-muted-foreground text-xs">{NOT_CHECKED}</p>
      </div>
    )
  }
  const coverage = COVERAGE[evidence.status]
  return (
    <div className="space-y-2 text-sm">
      {hypothesis && <p>Google Finance: {hypothesis}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={coverage.variant}>{coverage.label}</Badge>
        {evidence.reason && (
          <span className="text-muted-foreground text-xs">{evidence.reason}</span>
        )}
      </div>
      {evidence.claims.length > 0 && (
        <ul aria-label="Source passages" className="space-y-2">
          {evidence.claims.map((claim, index) => (
            <ClaimItem key={`${claim.source.url}-${index}`} claim={claim} />
          ))}
        </ul>
      )}
    </div>
  )
}
