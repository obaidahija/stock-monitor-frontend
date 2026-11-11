import { formatDate } from '@/lib/format'
import type { FilingKeyFact, SecVerification } from '@/types/api'

export const UNCHECKED_REASONS: Record<string, string> = {
  not_tagged: 'not tagged in the SEC filing',
  awaiting_filing: 'no SEC filing found',
  conflicting_sec_facts: 'SEC data conflicts',
  non_gaap: 'non-GAAP figure',
  period_kind_not_checked: 'year-to-date figure',
  issuer_not_collected: 'issuer not collected',
  collection_disabled: 'collection disabled',
  not_us_gaap: 'not reported in US GAAP',
}

export function displayAmount(fact: FilingKeyFact, value: string): string {
  const currency = fact.currency ?? (fact.value.includes('$') ? '$' : null)
  const amount = currency && !value.startsWith(currency) ? `${currency}${value}` : value
  return `${amount}${fact.unit ? ` ${fact.unit}` : ''}`
}

export function uncheckedText(check: SecVerification): string {
  const reason = check.reason ? UNCHECKED_REASONS[check.reason] ?? check.reason : null
  return `Not checked against SEC data${reason ? ` · ${reason}` : ''}`
}

/** A one-character status for compact value chips; the label is the accessible explanation. */
export function verificationMark(fact: FilingKeyFact, check: SecVerification) {
  switch (check.status) {
    case 'matched':
      return { symbol: '✓', label: `Verified against ${check.form} filed ${formatDate(check.filed)}`, tone: 'ok' as const }
    case 'differs':
      return { symbol: '!', label: `${check.form} reports a different value`, tone: 'warn' as const }
    case 'pending':
      return { symbol: '◷', label: `Awaiting ${fact.period_kind === 'annual' ? '10-K' : '10-Q'}`, tone: 'muted' as const }
    default:
      return { symbol: '–', label: uncheckedText(check), tone: 'muted' as const }
  }
}
