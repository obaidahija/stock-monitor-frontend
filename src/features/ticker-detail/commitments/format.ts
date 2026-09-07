import {
  BASIS_LABELS,
  METRIC_LABELS,
  OUTCOME_LABELS,
  type ComparisonOutcome,
  type CandidateProposal,
  type MetricIdentity,
  type NumericTarget,
} from '@/types/management-commitments'

/**
 * Display helpers shared by the picker, the review panel and the timeline.
 *
 * The rule that shapes all of them: guidance amounts are never converted to a
 * JavaScript `number`. `Number('9007199254740993')` silently becomes
 * ...992, and a revenue target is comfortably in that range. Everything here
 * formats the decimal *string* the API sent, character by character.
 */

/** Group an exact decimal string in threes without going through a float. */
export function groupDigits(value: string): string {
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction] = unsigned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = fraction ? `${grouped}.${fraction}` : grouped
  return negative ? `-${body}` : body
}

export function formatAmount(value: string, identity: MetricIdentity): string {
  if (identity.unit === 'percentage_points') return `${value}%`
  const currency = identity.currency ? `${identity.currency} ` : ''
  return `${currency}${groupDigits(value)}`
}

export function formatTarget(target: NumericTarget, identity: MetricIdentity): string {
  const lower = target.lower === null ? null : formatAmount(target.lower, identity)
  const upper = target.upper === null ? null : formatAmount(target.upper, identity)
  switch (target.operator) {
    case 'range':
      return `${lower} to ${upper}`
    case 'eq':
      return `${lower}`
    case 'gte':
      return `at least ${lower}`
    case 'lte':
      // Preserved as a ceiling, not a floor: reading this as "up to" is what
      // makes an overshoot read as "above limit" rather than as good news.
      return `no more than ${upper}`
  }
}

export function formatPeriod(identity: MetricIdentity): string {
  if (identity.fiscal_label) return identity.fiscal_label
  const kind = identity.period_kind === 'quarter' ? 'Quarter' : 'Year'
  return `${kind} ending ${formatDate(identity.period_end)}`
}

export function describeIdentity(identity: MetricIdentity): string {
  const basis = identity.basis === 'unspecified' ? '' : `${BASIS_LABELS[identity.basis]} `
  return `${basis}${METRIC_LABELS[identity.metric].toLowerCase()}`
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
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

export function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString()
}

/**
 * Colour is supplementary here, never the message. Each outcome always ships
 * with its own words, so the meaning survives a monochrome screen or a reader
 * who cannot distinguish the hues.
 */
export function outcomeVariant(
  outcome: ComparisonOutcome,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (outcome) {
    case 'met':
    case 'exceeded':
      return 'default'
    case 'below':
    case 'above_limit':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function outcomeLabel(outcome: ComparisonOutcome, benchmark: 'original' | 'latest') {
  const which = benchmark === 'original' ? 'original target' : 'latest target'
  if (outcome === 'not_comparable') return `Not comparable to ${which}`
  return `${OUTCOME_LABELS[outcome]} ${which}`
}

export const NOTICE_COPY: Record<string, string> = {
  conflicting_actuals:
    'More than one reported result is recorded for this period. A correction is needed to select the valid one.',
  actual_definition_mismatch:
    'The reported result uses a different adjustment definition to the target, so the two are not comparable.',
  actual_basis_unknown:
    'The accounting basis is not established on both sides, so no comparison is made.',
  ambiguous_same_day_ordering:
    'A target and the reported result carry the same date. Filings record a date but not a time, so the order cannot be established.',
  no_eligible_target:
    'No target was stated before the reported result, so there is nothing to compare it against.',
  retrospective_target_ignored:
    'A target stated after the period ended is kept in history but is not used as a benchmark.',
  reaffirmation_value_mismatch:
    'A reaffirmation restates a different number to the guidance in force.',
  guidance_withdrawn:
    'Guidance was withdrawn before the result was reported, so no guidance was in force at the time.',
}

export const SOURCE_NOTICE_COPY: Record<string, string> = {
  item_metadata_missing:
    'Some filings had no item metadata and are listed as unclassified candidates.',
  filing_limit_reached: 'The filing limit was reached; older filings were not listed.',
  document_limit_reached: 'The document limit was reached; some attachments were not listed.',
  history_limit_reached: 'The archive-file limit was reached before the window was fully covered.',
  deadline_reached: 'The time budget was reached; the sweep stopped early.',
  filing_index_unavailable: 'One or more filing index pages could not be read.',
  table_too_large: 'A table was too large to represent reliably and was skipped.',
  no_readable_blocks: 'No readable text could be extracted from this document.',
  unsupported_document_type: 'This attachment type cannot be parsed. Open it on SEC instead.',
  no_guidance_blocks: 'No passage in this document looked like numeric guidance.',
  invalid_json: 'The model reply could not be parsed.',
  all_proposals_rejected:
    'The model returned statements, but none passed validation against the source. Try proposing again or add a statement manually.',
  ai_deadline_reached: 'The model did not respond within the time budget.',
  quote_mismatch: 'A proposed quotation did not match the saved source text and was discarded.',
  unknown_block: 'A proposal referenced a passage that was not part of this document.',
}

/**
 * Mirrors the backend's own `unresolved` rule so the button state matches what
 * the API will accept. The backend remains the authority: this only avoids
 * offering an action that is certain to be refused.
 */
export function unresolvedFields(proposal: CandidateProposal): string[] {
  const missing: string[] = []
  if (!proposal.period_start) missing.push('period_start')
  if (!proposal.period_end) missing.push('period_end')
  if (!proposal.period_kind) missing.push('period_kind')
  if (!proposal.statement_date) missing.push('statement_date')
  if (proposal.metric === 'revenue' && !proposal.currency) missing.push('currency')
  if (['issued', 'revised', 'reinstated'].includes(proposal.kind) && !proposal.target) {
    missing.push('target')
  }
  if (proposal.kind === 'actual' && !proposal.actual_value) missing.push('actual_value')
  return missing
}
