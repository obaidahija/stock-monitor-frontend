import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FilingEventOut, Scorecard, ScorecardRow } from '@/types/filing-intel'

const UP = 'text-emerald-600 dark:text-emerald-400'
const DOWN = 'text-red-600 dark:text-red-400'

function money(row: ScorecardRow, value: number | null | undefined): string {
  return row.unit === 'usd' ? formatCompactCurrency(value) : formatCurrency(value)
}

function pct(value: number): string {
  return `${Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}%`
}

function source(value: string | null | undefined): string {
  return !value || value === 'release' ? 'from the release' : `from the ${value}`
}

/** "Beat by 9%" / "Miss by 2%" / "In line", coloured like the photo the user asked for. */
function Verdict({ row }: { row: ScorecardRow }) {
  if (row.result === null || row.surprise_pct === null) return <span className="text-muted-foreground">—</span>
  if (row.result === 'in_line') return <span className="text-muted-foreground">In line</span>
  return (
    <span className={cn('font-semibold', row.result === 'beat' ? UP : DOWN)}>
      {row.result === 'beat' ? 'Beat' : 'Miss'} by {pct(Math.abs(row.surprise_pct))}
    </span>
  )
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('font-semibold', value > 0 ? UP : value < 0 ? DOWN : '')}>
      {value > 0 ? 'up' : value < 0 ? 'down' : 'flat'} {pct(Math.abs(value))}
    </span>
  )
}

/** The earnings filing's numbers against consensus, then the change on a year and a quarter. */
export function EarningsScorecard({ scorecard }: { scorecard: Scorecard | null | undefined }) {
  if (!scorecard?.rows.length) return null
  return (
    <section aria-label="Earnings scorecard" className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Parameter</th>
              <th className="px-3 py-2 text-right font-semibold">Expected</th>
              <th className="px-3 py-2 text-right font-semibold">Actual</th>
              <th className="px-3 py-2 text-right font-semibold">Beat / Miss</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.rows.map((row) => (
              <tr key={row.metric} className="border-t">
                <td className="px-3 py-2 font-medium">{row.label}</td>
                <td className="px-3 py-2 text-right">{money(row, row.expected)}</td>
                <td className="px-3 py-2 text-right">{money(row, row.actual)}</td>
                <td className="px-3 py-2 text-right">
                  <Verdict row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-sm">
        {scorecard.rows.map((row) => (
          <li key={row.metric}>
            <span className="font-medium">{row.label}</span>{' '}
            <span
              title={
                row.prior_year !== null
                  ? `Same quarter a year earlier: ${money(row, row.prior_year)} (${source(row.yoy_source)})`
                  : 'No year-earlier figure in the release or the earnings calendar'
              }
            >
              <Change value={row.yoy_pct} /> year over year
            </span>
            {' · '}
            <span
              title={
                row.prior_quarter !== null
                  ? `Previous quarter: ${money(row, row.prior_quarter)} (${source(row.qoq_source)})`
                  : 'No previous-quarter figure on the same basis in the release, our stored filings or the earnings calendar'
              }
            >
              <Change value={row.qoq_pct} /> quarter over quarter
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const GUIDE_METRIC: Record<string, string> = { adjusted_eps: 'Adj. EPS', eps: 'EPS', revenue: 'Revenue' }
const GUIDE_ORDER = ['adjusted_eps', 'eps', 'revenue']
const CHANGE_WORD: Record<string, string> = {
  raised: 'Raised',
  lowered: 'Lowered',
  reaffirmed: 'Reaffirmed',
  narrowing: 'Narrowed',
  narrowed: 'Narrowed',
}

function guideValue(event: FilingEventOut, key: string): string {
  const value = event.fields[key] as number
  const unit = event.fields.unit
  if (unit === 'pct') return `${value}%`
  return unit === 'USD/shares' ? formatCurrency(value) : formatCompactCurrency(value)
}

function signedPct(value: number): string {
  return `${value > 0 ? '+' : ''}${pct(value)}`
}

/** The headline guidance of a results release: EPS first, then revenue, with a range. */
export function headlineGuidance(events: FilingEventOut[]): FilingEventOut | null {
  const ranged = events.filter(
    (e) => e.event_type === 'guidance' && typeof e.fields.low === 'number' && typeof e.fields.high === 'number',
  )
  for (const metric of GUIDE_ORDER) {
    const hit = ranged.find((e) => e.fields.metric === metric)
    if (hit) return hit
  }
  return null
}

function metricName(row: ScorecardRow): string {
  return row.metric === 'eps' ? (row.basis === 'adjusted' ? 'Adj. EPS' : 'EPS (GAAP)') : 'Revenue'
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <span className={value > 0 ? UP : value < 0 ? DOWN : ''}>{signedPct(value)}</span>
}

/**
 * The panel's scorecard table at row size: Expected / Actual / Beat-Miss plus the year and
 * quarter change, and the headline guidance on one line under it.
 */
export function ScorecardMiniTable({ scorecard, events }: { scorecard: Scorecard | null | undefined; events: FilingEventOut[] }) {
  const rows = scorecard?.rows ?? []
  const guide = headlineGuidance(events)
  if (rows.length === 0 && !guide) return null
  const change = guide ? String(guide.fields.change ?? '') : ''
  return (
    <div className="space-y-1">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs tabular-nums" aria-label="Earnings results">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Parameter</th>
                <th className="px-2 py-1 text-right font-medium">Expected</th>
                <th className="px-2 py-1 text-right font-medium">Actual</th>
                <th className="px-2 py-1 text-right font-medium">Beat / Miss</th>
                <th className="px-2 py-1 text-right font-medium">YoY</th>
                <th className="px-2 py-1 text-right font-medium">QoQ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.metric} className="border-t">
                  <td className="px-2 py-1 font-medium whitespace-nowrap">{metricName(row)}</td>
                  <td className="px-2 py-1 text-right">{money(row, row.expected)}</td>
                  <td className="px-2 py-1 text-right">{money(row, row.actual)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <Verdict row={row} />
                  </td>
                  <td className="px-2 py-1 text-right" title={row.prior_year !== null ? `A year earlier: ${money(row, row.prior_year)}` : undefined}>
                    <Delta value={row.yoy_pct} />
                  </td>
                  <td className="px-2 py-1 text-right" title={row.prior_quarter !== null ? `Previous quarter: ${money(row, row.prior_quarter)} (${source(row.qoq_source)})` : undefined}>
                    <Delta value={row.qoq_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {guide && (
        <p className="text-xs" title={(guide.evidence[0]?.text ?? '').slice(0, 300)}>
          <span className="text-muted-foreground">{guide.fields.period ? `${String(guide.fields.period)} ` : ''}guidance </span>
          {CHANGE_WORD[change] && (
            <span className={cn('font-semibold', change === 'raised' ? UP : change === 'lowered' ? DOWN : 'text-muted-foreground')}>
              {CHANGE_WORD[change].toLowerCase()}{' '}
            </span>
          )}
          <span className="tabular-nums">
            {GUIDE_METRIC[String(guide.fields.metric)] ?? ''} {guideValue(guide, 'low')}–{guideValue(guide, 'high')}
          </span>
          {typeof guide.fields.prior_low === 'number' && typeof guide.fields.prior_high === 'number' && (
            <span className="text-muted-foreground tabular-nums">
              {' '}(was {guideValue(guide, 'prior_low')}–{guideValue(guide, 'prior_high')})
            </span>
          )}
        </p>
      )}
    </div>
  )
}
