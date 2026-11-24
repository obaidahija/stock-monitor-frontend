import { formatMoneyAmount, formatCompactNumber } from '@/lib/format'
import type {
  ExpectedBasis,
  ExpectedConfidence,
  ExpectedStatus,
  FilingEventOut,
  PriceSession,
} from '@/types/filing-intel'

export const BASIS_LABEL: Record<ExpectedBasis, string> = {
  earnings_calendar: 'Earnings date',
  issuer_history: "Issuer's own history",
  statutory_deadline: 'SEC deadline',
}

export const BASIS_EXPLANATION: Record<ExpectedBasis, string> = {
  earnings_calendar:
    'Earnings 8-Ks land on the calendar earnings date 95% of the time; the window uses before/after-market timing.',
  issuer_history: 'How many days after its results this company has filed its 10-Q/10-K in past quarters.',
  statutory_deadline: 'No earnings date known: the latest date the SEC rules allow for this filer category.',
}

export const CONFIDENCE_CLASS: Record<ExpectedConfidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent',
  low: 'bg-muted text-muted-foreground border-transparent',
}

export const STATUS_CLASS: Record<ExpectedStatus, string> = {
  expected: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-transparent',
  filed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent',
  late: 'bg-red-500/15 text-red-700 dark:text-red-400 border-transparent',
}

export const DIRECTION_CLASS: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent',
  negative: 'bg-red-500/15 text-red-700 dark:text-red-400 border-transparent',
  mixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent',
}

export const TOPIC_OPTIONS = [
  'earnings_results',
  'clinical_trial_result',
  'fda_regulatory',
  'm_and_a',
  'divestiture',
  'equity_offering',
  'debt_offering',
  'guidance_update',
  'buyback',
  'dividend',
  'restructuring',
  'executive_change',
  'stock_split',
  'listing_compliance',
  'partnership_license',
  'contract_award',
  'litigation',
  'investor_presentation',
] as const

export function humanize(key: string): string {
  const text = key.replace(/_/g, ' ').replace(/\bpct\b/, '%').replace(/\bbp\b/, '(bp)')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The label a reader sees for an event: its topic for a disclosure, else its type. */
export function eventLabel(event: FilingEventOut): string {
  if (event.event_type === 'disclosure') return humanize(event.topic ?? 'unclassified')
  return humanize(event.event_type)
}

const MONEY_KEYS =
  /(revenue|income|profit|cash|debt|proceeds|principal|consideration|amount|charges?|market_cap|value|size|fee|offering$|expenses|capex|flow|equity|assets|liabilities|largest_amount|accordion_to|program_size|midpoint$|low$|high$)/
// registered_amount is a count of securities (the fee exhibit's AmtSctiesRegd), not dollars.
const SHARE_KEYS = /(shares|headcount|registered_amount)/
const PER_SHARE_KEYS = /(eps|per_share|price|last_close|exercise_price|surprise$)/

/** One value formatted by what its key names: %, $, per-share $, share count, date, flag. */
export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') return value.replace(/_/g, ' ')
  const n = value as number
  if (/_bp$/.test(key)) return `${n > 0 ? '+' : ''}${n.toFixed(0)} bp`
  if (/_pct(_|$)/.test(key)) {
    const signed = /yoy|change|discount|surprise/.test(key)
    return `${signed && n > 0 ? '+' : ''}${n.toFixed(2)}%`
  }
  if (/hazard_ratio|p_value|factor|coupon/.test(key)) return String(n)
  if (/months|days|year|tenor|count|departures|appointments|version/.test(key)) return String(n)
  if (SHARE_KEYS.test(key) && !/per_share/.test(key)) return `${formatCompactNumber(n)} sh`
  if (PER_SHARE_KEYS.test(key) && Math.abs(n) < 10_000) return `$${n.toFixed(2)}`
  if (MONEY_KEYS.test(key)) return formatMoneyAmount(n)
  return formatCompactNumber(n)
}

/** Feature groups, in reading order. Keys not listed land in "Other". */
export const FEATURE_GROUPS: { title: string; keys: RegExp }[] = [
  { title: 'Results', keys: /^(revenue|gross_profit|operating_income|net_income|eps_|adjusted_|comparable_sales|shares_diluted|research_and)/ },
  { title: 'Margins', keys: /(margin|rd_intensity)/ },
  { title: 'Vs. expectations', keys: /(surprise|estimate|guidance)/ },
  { title: 'Balance sheet & cash', keys: /^(cash|total_|long_term|short_term|net_debt|inventory|receivables|equity|deferred|operating_cash|free_cash|ocf|dso|shares_outstanding)/ },
  { title: 'Offering & financing', keys: /(offering|at_the_market|debt_principal|convertible)/ },
  { title: 'Events', keys: /(trial_|ceo|cfo|chair|interim|involuntary|officer|restructuring|impairment|reverse_split|listing|bankruptcy|auditor|non_reliance|cyber|change_in_control|vote|say_on_pay|acquisition|disposition|disclosed_direction|primary_topic|topics)/ },
]
export const FEATURE_SKIP = new Set(['feature_version', 'form', 'items', 'sector', 'industry', 'market_cap'])

export const MAX_TICKERS = 25

/** "nvda, TGT;sls  tgt" -> ["NVDA", "TGT", "SLS"], at most MAX_TICKERS. */
export function parseTickers(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_TICKERS)
}

export const COVERAGE_LABEL = { tracked: 'Your universe', extended: 'Outside universe' } as const
export const COVERAGE_HINT =
  'Not in your tracked tickers: an untracked US-listed company at or above the market-cap floor (default $1B).'

const SESSION_LABEL: Record<PriceSession, string> = { pre: 'pre-market', regular: 'regular', post: 'after-hours' }

export function sessionLabel(session: PriceSession | null | undefined): string {
  return session ? SESSION_LABEL[session] : ''
}

export const SIGNAL_SOURCE_LABEL = {
  disclosed: 'Stated in the filing',
  results: 'Results vs consensus',
  tone: 'Text tone (FinBERT)',
} as const

export const KIND_LABEL = {
  earnings: 'Earnings',
  guidance: 'Guidance',
  event: 'Event',
  periodic_report: 'Periodic report',
  offering: 'Offering',
  other: 'Other',
} as const

export const KIND_CLASS: Record<keyof typeof KIND_LABEL, string> = {
  earnings: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-transparent',
  guidance: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-transparent',
  event: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent',
  periodic_report: 'bg-muted text-muted-foreground border-transparent',
  offering: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-transparent',
  other: 'bg-muted text-muted-foreground border-transparent',
}

export const KIND_HINT =
  'Earnings = Item 2.02 (or a 7.01/8.01 release that reports results). Event = any other 8-K news.'
