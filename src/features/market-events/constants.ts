import type { MarketEventCategory, MarketEventStance } from '@/types/api'

// Deliberately neutral-toned, not red/green -- unlike a per-sector predicted
// direction, "hawkish"/"dovish" is not itself universally positive or
// negative (a hawkish Fed read is bad for growth sectors but good for
// banks). The directional read lives on each sector-impact row instead;
// see DIRECTION_CLASSES in market-events-list.tsx.
export const MARKET_EVENT_STANCE_LABEL: Record<MarketEventStance, string> = {
  hawkish: 'Hawkish lean',
  dovish: 'Dovish lean',
  neutral_inline: 'In line with consensus',
  unresolved: 'Too uncertain to call',
}

// One line on what "hawkish"/"dovish" concretely means for THIS event --
// mirrors macro_event_resolver.Stance's own doc comment (the restrictive/
// adverse-for-risk-assets pole vs. the easing/favorable pole), written for a
// reader with no prior context rather than assuming Fed jargon is familiar.
export const MARKET_EVENT_STANCE_EXPLANATION: Record<MarketEventStance, string> = {
  hawkish:
    'Markets currently expect this to resolve toward the more restrictive, risk-off outcome for this kind of event.',
  dovish:
    'Markets currently expect this to resolve toward the more easing, risk-on outcome for this kind of event.',
  neutral_inline:
    'Expected to land in line with what markets already priced in -- limited surprise, so limited reaction expected either way.',
  unresolved: "Genuinely too uncertain to call a likely direction yet -- treated as no signal.",
}

// Why each category is on the calendar at all -- the mechanism connecting
// the event to markets, in plain language. Matches the category vocabulary
// app/intelligence/macro_transmission_rules.py already defines, so the same
// 7 categories (plus the 'other' fallback) appear here and on the Macro page.
export const MARKET_EVENT_CATEGORY_LABEL: Record<MarketEventCategory, string> = {
  oil_energy: 'Oil & Energy',
  geopolitical_conflict: 'Geopolitical',
  rates_fed: 'Rates & Fed',
  treasury_debt: 'Treasury & Debt',
  banking_credit: 'Banking & Credit',
  trade_tariffs: 'Trade & Tariffs',
  inflation: 'Inflation',
  other: 'Other',
}

export const MARKET_EVENT_CATEGORY_EXPLANATION: Record<MarketEventCategory, string> = {
  oil_energy:
    'Crude/energy price moves ripple through inflation, input costs, and the Energy sector directly.',
  geopolitical_conflict:
    'Escalation or de-escalation abroad shifts risk appetite market-wide and can threaten supply chains or shipping routes.',
  rates_fed:
    "The Federal Reserve's rate decisions and guidance are the single biggest lever on borrowing costs and long-duration growth valuations.",
  treasury_debt:
    'US government borrowing and Treasury yields set the discount rate underpinning every other asset class.',
  banking_credit:
    'Bank health and credit conditions -- stress here tends to tighten lending and can pull forward rate-cut expectations.',
  trade_tariffs:
    'Tariffs imposed or lifted directly move costs for import/export-exposed companies.',
  inflation:
    'Consumer/producer price data shapes both Fed policy expectations and real household purchasing power.',
  other:
    "Doesn't fit MarketScout's fixed macro category set, so no sector-transmission mapping is applied -- shown for awareness only.",
}

export type EventUrgency = 'today' | 'tomorrow' | 'this-week' | 'later' | 'past'

export interface DayInfo {
  /** Full weekday name, e.g. "Wednesday". */
  weekday: string
  /** Short month/day, e.g. "Sep 17". */
  monthDay: string
  /** "Today" / "Tomorrow" / "In 5 days" / "3 days ago". */
  relative: string
  urgency: EventUrgency
  diffDays: number
}

// value is a plain "YYYY-MM-DD" calendar date (no time/timezone -- backend
// Pydantic `date` fields serialize this way). Parsed into local-time
// components directly, same approach as lib/format.ts's formatDate, so the
// day-count isn't off by one in a timezone behind UTC.
export function getDayInfo(value: string): DayInfo {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  const weekday = target.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  let relative: string
  let urgency: EventUrgency
  if (diffDays === 0) {
    relative = 'Today'
    urgency = 'today'
  } else if (diffDays === 1) {
    relative = 'Tomorrow'
    urgency = 'tomorrow'
  } else if (diffDays > 1 && diffDays <= 7) {
    relative = `In ${diffDays} days`
    urgency = 'this-week'
  } else if (diffDays > 7) {
    relative = `In ${diffDays} days`
    urgency = 'later'
  } else {
    relative = `${Math.abs(diffDays)} day${diffDays === -1 ? '' : 's'} ago`
    urgency = 'past'
  }
  return { weekday, monthDay, relative, urgency, diffDays }
}

// Left-accent-bar color per urgency tier for the day-group header -- the
// primary "when does this happen" cue, distinct from and louder than the
// per-event badges below it. Today/tomorrow get the app's existing
// attention-orange (same hue the Trending nav item uses); this week is
// amber; later/past fade to muted so the eye lands on what's imminent.
export const URGENCY_ACCENT_CLASSES: Record<EventUrgency, string> = {
  today: 'border-orange-500',
  tomorrow: 'border-orange-400/70',
  'this-week': 'border-amber-500/60',
  later: 'border-border',
  past: 'border-border',
}

export const URGENCY_BADGE_CLASSES: Record<EventUrgency, string> = {
  today: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent',
  tomorrow: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-transparent',
  'this-week': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
  later: 'bg-muted text-muted-foreground border-transparent',
  past: 'bg-muted text-muted-foreground border-transparent',
}
