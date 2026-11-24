import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FilingSignal } from '@/types/filing-intel'
import { DIRECTION_CLASS, SIGNAL_SOURCE_LABEL } from './labels'

/** "Positive · strong" with the reasons on hover. */
export function SignalBadge({ signal, className }: { signal: FilingSignal | null; className?: string }) {
  if (!signal?.label) return null
  const reasons = signal.reasons.map((r) => `${SIGNAL_SOURCE_LABEL[r.source]}: ${r.detail}`).join('\n')
  return (
    <Badge className={cn(DIRECTION_CLASS[signal.label], className)} title={reasons}>
      {signal.label}
      {signal.strength === 'strong' && ' · strong'}
    </Badge>
  )
}

/**
 * One piece of evidence. Tone quotes arrive as "positive 0.96: sentence" (FinBERT's score for
 * that sentence alone; "against, ..." marks the strongest sentence pulling the other way).
 */
function EvidenceQuote({ source, quote }: { source: string; quote: string }) {
  const tone = source === 'tone' ? /^(against, )?(positive|negative) ([\d.]+): (.*)$/s.exec(quote) : null
  if (!tone) {
    return <blockquote className="border-border text-muted-foreground border-l-2 pl-2 text-xs">{quote}</blockquote>
  }
  const [, against, label, score, text] = tone
  return (
    <blockquote
      className={cn(
        'border-l-2 pl-2 text-xs',
        label === 'positive' ? 'border-emerald-500/60' : 'border-red-500/60',
        against && 'opacity-80',
      )}
    >
      <span className={cn('font-medium', label === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {against ? 'Pulls the other way' : 'Drove the tone'} · {label} {score}
      </span>
      <span className="text-muted-foreground block">{text}</span>
    </blockquote>
  )
}

const CONTEXT_MARK = { positive: '▲', negative: '▼', neutral: '●' } as const
const CONTEXT_CLASS = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
} as const

const CONTEXT_SOURCE_LABEL = {
  guidance_vs_consensus: 'Guidance vs consensus',
  beat_vs_raise: 'Raise vs beat',
  one_time_item: 'One-time item',
  deal_terms: 'Deal terms',
} as const

/** Context the label does not count, each with its numbers and the quoted sentence. */
export function SignalContext({ signal }: { signal: FilingSignal | null }) {
  const items = signal?.context ?? []
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">Also in the filing · not counted in the label</p>
      <ul className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className={cn('font-medium', CONTEXT_CLASS[item.direction])}>{CONTEXT_MARK[item.direction]}</span>
            <div className="min-w-0">
              <span className="text-muted-foreground">{CONTEXT_SOURCE_LABEL[item.source]}: </span>
              {item.detail}
              {item.evidence.map((quote, i) => (
                <EvidenceQuote key={i} source={item.source} quote={quote} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Not yet validated, so not counted: EPS guidance more than 2% under consensus preceded a fall 71% of the time
        (14 filings); a full-year raise smaller than the beat averaged -4.8% vs its sector (4 filings); only 24% of
        divestitures rose the next day (17 filings).
      </p>
    </div>
  )
}

/** A filing-row flag when next-quarter guidance sits below (or above) consensus. */
export function GuidanceContextBadge({ signal }: { signal: FilingSignal | null }) {
  const items = (signal?.context ?? []).filter((c) => c.source === 'guidance_vs_consensus' && c.direction !== 'neutral')
  if (items.length === 0) return null
  const below = items.some((c) => c.direction === 'negative')
  const above = items.some((c) => c.direction === 'positive')
  const text = below && above ? 'Guide mixed vs consensus' : below ? 'Guide below consensus' : 'Guide above consensus'
  return (
    <Badge
      variant="outline"
      className={cn(below && !above ? 'border-red-500/50 text-red-600 dark:text-red-400' : above && !below ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : '')}
      title={items.map((c) => c.detail).join('\n') + '\nNot counted in the label.'}
    >
      {text}
    </Badge>
  )
}

/** The reasons as a list, for the filing panel. */
export function SignalReasons({ signal }: { signal: FilingSignal | null }) {
  if (!signal?.label) {
    if (signal?.context?.length) return <SignalContext signal={signal} />
    return <p className="text-muted-foreground text-sm">No positive/negative read: nothing stated, no consensus gap, neutral tone.</p>
  }
  return (
    <div className="space-y-2">
      <SignalBadge signal={signal} />
      <ul className="space-y-1 text-sm">
        {signal.reasons.map((reason, index) => (
          <li key={index} className="flex gap-2">
            <span className={cn('font-medium', reason.direction === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {reason.direction === 'positive' ? '▲' : '▼'}
            </span>
            <div className="min-w-0">
              <span className="text-muted-foreground">{SIGNAL_SOURCE_LABEL[reason.source]}: </span>
              {reason.detail}
              {reason.evidence.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {reason.evidence.map((quote, i) => (
                    <li key={i}>
                      <EvidenceQuote source={reason.source} quote={quote} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
      <SignalContext signal={signal} />
      <p className="text-muted-foreground text-xs">
        Measured on 2,769 past filings: labels agreed with the next day's move vs SPY 56% of the time (60% when
        sources agree). A description of the filing, not a forecast.
      </p>
    </div>
  )
}
