import { ArrowLeftRight, ArrowRight, FileText, HelpCircle, Layers, Search, Target } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { CompetitorConfidence, CompetitorOut } from '@/types/api'

// Reuses the app's existing bullish/neutral/bearish-style status palette
// (see BIAS_META in chart-pattern-card.tsx, SCORE_LEAN_META in
// universe-table.tsx) rather than introducing a new one -- emerald/amber/
// muted already carries "high/medium/low attention-worthy" meaning
// consistently across the app.
const IMPACT_META: Record<CompetitorConfidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
}

const METER_FILL: Record<CompetitorConfidence, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/40',
}

// Bar length = impact tier (the headline "will this competitor's stock
// react" signal); opacity = confidence (a secondary encoding riding the
// same fill rather than a second bar) -- so two ordinal reads collapse
// into one glanceable meter instead of competing for attention. An
// unranked competitor (ranking LLM call failed, see competitors-tab.tsx's
// fallback state) gets its own near-empty treatment distinct from a
// genuinely low-impact one.
const METER_WIDTH: Record<CompetitorConfidence, string> = {
  high: 'w-full',
  medium: 'w-[60%]',
  low: 'w-[30%]',
}
const METER_WIDTH_UNRANKED = 'w-[10%]'

const METER_OPACITY: Record<CompetitorConfidence, string> = {
  high: 'opacity-100',
  medium: 'opacity-80',
  low: 'opacity-60',
}

const CONFIDENCE_LABEL: Record<CompetitorConfidence, string> = {
  high: 'high confidence',
  medium: 'medium confidence',
  low: 'low confidence',
}

function MutualNamingTag({ mutualNaming }: { mutualNaming: boolean | null }) {
  if (mutualNaming === true) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <ArrowLeftRight className="size-3.5" />
        Names each other back
      </span>
    )
  }
  if (mutualNaming === false) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <ArrowRight className="size-3.5" />
        Not named back
      </span>
    )
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      <HelpCircle className="size-3.5" />
      Mutual naming unchecked
    </span>
  )
}

function BusinessConcentrationTag({
  revenueDependence,
}: {
  revenueDependence: CompetitorOut['revenue_dependence']
}) {
  if (!revenueDependence || revenueDependence.is_core_business === null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <HelpCircle className="size-3.5" />
        Business concentration unknown
      </span>
    )
  }
  return revenueDependence.is_core_business ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <Target className="size-3.5" />
      Core business for them
    </span>
  ) : (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      <Layers className="size-3.5" />
      Diversified/bundled segment for them
    </span>
  )
}

function DiscoverySourceTag({ source }: { source: string }) {
  const viaReverseSearch = source.startsWith('reverse_10k_search')
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      {viaReverseSearch ? <Search className="size-3.5" /> : <FileText className="size-3.5" />}
      {viaReverseSearch ? 'Found via reverse SEC search' : "Named in target's own 10-K"}
    </span>
  )
}

export function CompetitorRow({ competitor }: { competitor: CompetitorOut }) {
  const nameContent = competitor.ticker ? (
    <Link to={`/stocks/${competitor.ticker}`} className="hover:underline">
      {competitor.name} <span className="text-muted-foreground">({competitor.ticker})</span>
    </Link>
  ) : (
    <span>
      {competitor.name} <span className="text-muted-foreground">(ticker unresolved)</span>
    </span>
  )

  return (
    <div className="border-border rounded-lg border px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
          {competitor.rank ?? '—'}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{nameContent}</span>
            {competitor.impact_likelihood && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                  IMPACT_META[competitor.impact_likelihood],
                )}
              >
                {competitor.impact_likelihood} impact
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {CONFIDENCE_LABEL[competitor.confidence]}
            </span>
          </div>

          <div
            className="bg-muted h-1.5 w-full max-w-40 overflow-hidden rounded-full"
            role="img"
            aria-label={`Impact ${competitor.impact_likelihood ?? 'unranked'}, ${CONFIDENCE_LABEL[competitor.confidence]}`}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                competitor.impact_likelihood
                  ? [METER_FILL[competitor.impact_likelihood], METER_WIDTH[competitor.impact_likelihood]]
                  : ['bg-muted-foreground/30', METER_WIDTH_UNRANKED],
                METER_OPACITY[competitor.confidence],
              )}
            />
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <MutualNamingTag mutualNaming={competitor.mutual_naming} />
            <BusinessConcentrationTag revenueDependence={competitor.revenue_dependence} />
            <DiscoverySourceTag source={competitor.source} />
          </div>

          {competitor.reasoning && <p className="text-sm">{competitor.reasoning}</p>}
        </div>
      </div>
    </div>
  )
}
