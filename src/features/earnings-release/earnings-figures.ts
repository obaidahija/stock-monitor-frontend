import { amountCurrency, displayAmount } from '@/lib/display-amount'
import { formatCompactCurrency, formatDate } from '@/lib/format'
import type { FilingAnalysis, FilingKeyFact } from '@/types/api'

export type FigureColumn = 'reported' | 'adjusted'

export interface FigureRow {
  key: string
  label: string
  period: string
  cells: Partial<Record<FigureColumn, FilingKeyFact>>
}

const SCALE: Record<string, number> = { thousand: 1e3, thousands: 1e3, million: 1e6, millions: 1e6, billion: 1e9, billions: 1e9 }
/** Sort order for a fact's or finding's importance: high first. */
export const IMPORTANCE = { high: 0, medium: 1, low: 2 }

/** "Quarter · Oct 25, 2026", "As of Oct 25, 2026", or the release's own period text. */
export function periodLabel(fact: FilingKeyFact): string {
  const date = fact.period_end ? formatDate(fact.period_end) : fact.period
  const kind = { instant: 'As of', quarter: 'Quarter ·', annual: 'Year ·', year_to_date: 'YTD ·', not_disclosed: '' }[fact.period_kind]
  return kind ? `${kind} ${date}` : fact.period
}

/** A plain stated number ("115,844", "(1,299)", "-0.05"), or null for wording such as "130 to 140". */
function parseNumber(value: string): number | null {
  const text = value.trim()
  const match = /^(\()?(-)?([\d,]*\d(?:\.\d+)?)(\))?$/.exec(text)
  if (!match || Boolean(match[1]) !== Boolean(match[4])) return null
  const number = Number(match[3].replace(/,/g, ''))
  return match[1] || match[2] ? -number : number
}

function isDollar(fact: FilingKeyFact) {
  const currency = amountCurrency(fact)
  return currency === '$' || currency === 'USD'
}

/** The fact's value as one comparable number, when it is a plain amount. */
function numericValue(fact: FilingKeyFact): number | null {
  const number = parseNumber(fact.value)
  if (number === null) return null
  const scale = fact.unit ? SCALE[fact.unit.toLowerCase()] : undefined
  return scale ? number * scale : number
}

/**
 * A stated value made easy to scan: dollar totals in thousands/millions/billions read
 * compact ("$115.84B"); a per-share amount drops "per share" (the row says EPS);
 * anything else keeps the release's wording.
 */
export function figureAmount(fact: FilingKeyFact, value: string = fact.value): string {
  const number = parseNumber(value)
  const scale = fact.unit ? SCALE[fact.unit.toLowerCase()] : undefined
  if (number !== null && scale && isDollar(fact)) return formatCompactCurrency(number * scale)
  if (fact.unit?.toLowerCase() === 'per share') return displayAmount({ ...fact, unit: null }, value)
  return displayAmount(fact, value)
}

const column = (fact: FilingKeyFact): FigureColumn => (fact.basis === 'adjusted' ? 'adjusted' : 'reported')

/** Two statements of the same figure: equal amounts, so showing both adds nothing. */
function sameFigure(a: FilingKeyFact, b: FilingKeyFact) {
  const left = numericValue(a)
  const right = numericValue(b)
  return left !== null && right !== null && Math.abs(left - right) <= Math.abs(left) * 1e-9
}

/**
 * Reported figures (not guidance) as one row per metric and period, with the
 * reported/GAAP and adjusted statements side by side. A figure the release states
 * twice is shown once, keeping the copy that carries a year-ago value; differing
 * values never merge, so a discrepancy stays visible as its own row.
 */
export function buildFigureRows(facts: FilingKeyFact[]): FigureRow[] {
  const ordered = facts
    .map((fact, index) => ({ fact, index }))
    .filter(({ fact }) => fact.metric !== 'guidance')
    .sort((a, b) => IMPORTANCE[a.fact.importance] - IMPORTANCE[b.fact.importance] || a.index - b.index)
  const rows: (FigureRow & { metric: string; periodKind: string; periodEnd: string | null })[] = []
  for (const { fact } of ordered) {
    const side = column(fact)
    // A release often dates one statement ("Oct 25, 2026") and names the other only by
    // its fiscal label ("Q3 FY27"); an undated statement joins the dated row.
    const samePeriod = (row: (typeof rows)[number]) => row.metric === fact.metric && row.periodKind === fact.period_kind
      && (row.periodEnd === fact.period_end || !row.periodEnd || !fact.period_end)
    const row = rows.find((candidate) => samePeriod(candidate)
      && (!candidate.cells[side] || sameFigure(candidate.cells[side]!, fact)))
    if (!row) {
      rows.push({
        key: `${fact.metric}|${fact.period_kind}|${fact.period_end ?? fact.period}|${rows.length}`,
        label: fact.label, period: periodLabel(fact), cells: { [side]: fact },
        metric: fact.metric, periodKind: fact.period_kind, periodEnd: fact.period_end,
      })
      continue
    }
    if (!row.cells[side] || (!row.cells[side]!.prior_value && fact.prior_value)) row.cells[side] = fact
    if (!row.periodEnd && fact.period_end) Object.assign(row, { periodEnd: fact.period_end, period: periodLabel(fact) })
  }
  return rows.map(({ key, label, period, cells }) => ({ key, label, period, cells }))
}

/** The period most rows share, said once above the table instead of on every row. */
export function commonPeriod(rows: FigureRow[]): string | null {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.period, (counts.get(row.period) ?? 0) + 1)
  let best: string | null = null
  for (const [period, count] of counts) if (best === null || count > counts.get(best)!) best = period
  return best
}

/** Whether a saved analysis is final enough for its own summary to be shown. */
export function analysisSettled(analysis: FilingAnalysis | null | undefined): analysis is FilingAnalysis {
  return Boolean(analysis) && ['completed', 'partial', 'failed'].includes(analysis!.status)
}
