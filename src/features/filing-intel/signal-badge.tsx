import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FilingSignal } from '@/types/filing-intel'
import { DIRECTION_CLASS, SIGNAL_SOURCE_LABEL } from './labels'

/** "Positive · strong" with the reasons on hover. */
export function SignalBadge({ signal, className }: { signal: FilingSignal | null; className?: string }) {
  if (!signal) return null
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

/** The reasons as a list, for the filing panel. */
export function SignalReasons({ signal }: { signal: FilingSignal | null }) {
  if (!signal) {
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
      <p className="text-muted-foreground text-xs">
        Measured on 2,769 past filings: labels agreed with the next day's move vs SPY 56% of the time (60% when
        sources agree). A description of the filing, not a forecast.
      </p>
    </div>
  )
}
