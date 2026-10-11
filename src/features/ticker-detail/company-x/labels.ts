import type {
  CompanyAccountType,
  CompanyConfirmationBasis,
  CompanyPostEvidenceOut,
  CompanyPostLabel,
} from '@/types/twitter-company'

export const POST_LABELS: Record<CompanyPostLabel, string> = {
  routine: 'Routine',
  company_news: 'Company news',
  material: 'Material',
}

/** "8-K · Items 2.02, 9.01", "8-K · Item 1.01" or just the form type. */
export function filingLabel(filing: CompanyPostEvidenceOut) {
  const codes = filing.item_codes
  if (codes.length === 0) return filing.form_type
  return `${filing.form_type} · ${codes.length === 1 ? 'Item' : 'Items'} ${codes.join(', ')}`
}

export const ACCOUNT_TYPE_LABELS: Record<CompanyAccountType, string> = {
  corporate: 'Corporate',
  investor_relations: 'Investor relations',
  brand: 'Brand/subsidiary',
  regional: 'Regional',
  support: 'Support',
}

export const ACCOUNT_TYPE_HINTS: Partial<Record<CompanyAccountType, string>> = {
  regional: 'Covers one region or country, not the whole company.',
  support: 'A customer support account; company announcements may be limited.',
}

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as CompanyAccountType[]

export const BASIS_LABELS: Record<CompanyConfirmationBasis, string> = {
  company_source: 'Confirmed from company source',
  user_confirmation: 'Confirmed by you',
}

const HANDLE_RE = /^@?([A-Za-z0-9_]{1,15})$/
const X_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com'])

/** The handle a typed @handle or x.com profile URL points at, for the preview link. */
export function previewHandle(input: string): string | null {
  const value = input.trim()
  const direct = HANDLE_RE.exec(value)
  if (direct) return direct[1]
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    const segments = url.pathname.split('/').filter(Boolean)
    if (!X_HOSTS.has(url.hostname.toLowerCase()) || segments.length !== 1) return null
    return HANDLE_RE.exec(segments[0])?.[1] ?? null
  } catch {
    return null
  }
}

/** Ends a sentence with the name without doubling a period ("Alphabet Inc."). */
export function endSentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`
}
