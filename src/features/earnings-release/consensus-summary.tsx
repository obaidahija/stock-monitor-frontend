import { formatCompactCurrency, formatCurrency, formatEasternDateTimeWithYear, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ConsensusComparison, EarningsEstimates, GuidanceComparison } from '@/types/earnings-release'

const RESULT = { beat: 'Beat', miss: 'Miss', in_line: 'In line' }
const RESULT_TONE = { beat: 'text-emerald-700 dark:text-emerald-400', miss: 'text-red-700 dark:text-red-400', in_line: 'text-muted-foreground' }
const POSITION = { below: 'Consensus below range', within: 'Consensus within range', above: 'Consensus above range' }
const NOT_COMPARED_LABEL: Record<string, string> = {
  eps: 'EPS', revenue: 'Revenue', guidance_eps: 'EPS guidance', guidance_revenue: 'Revenue guidance',
}

function ResultLine({ label, comparison, format }: {
  label: string
  comparison: ConsensusComparison
  format: (value: number) => string
}) {
  return <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <p>{label} {format(comparison.reported)} vs {format(comparison.estimate)} expected</p>
    <span className={cn('text-xs font-semibold', RESULT_TONE[comparison.result])}>
      {RESULT[comparison.result]}{comparison.surprise_pct === null ? '' : ` · ${formatSignedPct(comparison.surprise_pct, 1)}`}
    </span>
    {comparison.basis_note && <p className="w-full text-xs text-muted-foreground">{comparison.basis_note}</p>}
  </div>
}

function GuidanceLine({ label, guidance, format }: {
  label: string
  guidance: GuidanceComparison
  format: (value: number) => string
}) {
  return <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <p>{guidance.period ? `${guidance.period} ` : ''}{label} guidance {guidance.low === guidance.high ? format(guidance.low) : `${format(guidance.low)}–${format(guidance.high)}`} · consensus {format(guidance.estimate)}</p>
    <span className="text-xs text-muted-foreground">{POSITION[guidance.position]}</span>
    {guidance.basis_note && <p className="w-full text-xs text-muted-foreground">{guidance.basis_note}</p>}
  </div>
}

/** Reported results and next-quarter guidance against consensus; null when nothing compares. */
export function ConsensusSummary({ ticker, estimates }: { ticker: string; estimates: EarningsEstimates }) {
  const { eps, revenue, guidance } = estimates
  const notCompared = estimates.not_compared ?? []
  if (!eps && !revenue && !guidance?.eps && !guidance?.revenue && notCompared.length === 0) return null
  return <section aria-label={`${ticker} against consensus`} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-sm">
    <h5 className="text-xs font-medium text-muted-foreground">
      {estimates.consensus_captured_at
        ? `Against consensus captured ${formatEasternDateTimeWithYear(estimates.consensus_captured_at)}`
        : 'Against current consensus'}
    </h5>
    {eps && <ResultLine label={eps.basis === 'adjusted' ? 'Adjusted EPS' : 'EPS'} comparison={eps} format={formatCurrency} />}
    {revenue && <ResultLine label="Revenue" comparison={revenue} format={formatCompactCurrency} />}
    {guidance?.eps && <GuidanceLine label="EPS" guidance={guidance.eps} format={formatCurrency} />}
    {guidance?.revenue && <GuidanceLine label="revenue" guidance={guidance.revenue} format={formatCompactCurrency} />}
    {notCompared.map((item) => <p key={item.metric} className="text-xs text-muted-foreground">
      {NOT_COMPARED_LABEL[item.metric] ?? item.metric}: {item.reason}
    </p>)}
  </section>
}
