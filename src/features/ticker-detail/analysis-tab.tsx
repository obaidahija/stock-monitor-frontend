import {
  Activity,
  AlertTriangle,
  AtSign,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronRight,
  Globe2,
  Layers,
  LineChart,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScoreHistoryChart } from './score-history-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import {
  formatCurrency,
  formatDate,
  formatEasternDate,
  formatEasternDateTime,
  formatEasternTime,
  formatRelativeTime,
  formatScore,
  formatSignedPct,
} from '@/lib/format'
import { LEAN_COLOR_CLASSES } from '@/lib/lean-colors'
import { cn } from '@/lib/utils'
import { CapabilityNotice } from '@/features/research/capability-notice'
import { useResearchCapabilities } from '@/features/research/hooks'
import {
  formatWindowExpiry,
  parseHorizonSessions,
  sessionsLabel,
} from '@/features/watchlists/research-window'
import { ResearchWindowControl } from '@/features/watchlists/research-window-control'
import { ChartPatternCard } from './chart-pattern-card'
import { PeerRankLine } from './peer-rank-line'
import { WindowRiskChip } from './window-risk-chip'
import { EventWindowCard } from './event-window'
import { ShortInterestCard } from './short-interest-card'
import { ACTION_BADGE_CLASSES, actionLabel, gradeText } from './analyst-action-labels'
import {
  useAnalysis,
  useAnalystPriceTargetHistory,
  useRefreshUniverseScore,
  useUniverseScore,
} from './hooks'
import type {
  AnalystDetailOut,
  ComponentScoreOut,
  EventWindowOut,
  PriceLevelPosition,
  PriceLevelsOut,
  PriceTargetChangeOut,
  ResistanceReachability,
  SelectedVolatilityOut,
  SwingWindow,
} from '@/types/api'

const FACTOR_META: Record<string, { label: string; icon: LucideIcon }> = {
  fundamentals: { label: 'Fundamentals', icon: Building2 },
  momentum: { label: 'Momentum', icon: Activity },
  extension_risk: { label: 'Extension risk', icon: AlertTriangle },
  analyst_sentiment: { label: 'Analyst sentiment', icon: Users },
  earnings: { label: 'Earnings', icon: CalendarClock },
  news_sentiment: { label: 'News sentiment', icon: Newspaper },
  social_sentiment: { label: 'Social sentiment', icon: MessageCircle },
  twitter_sentiment: { label: 'Twitter/X sentiment', icon: AtSign },
  reddit_sentiment: { label: 'Reddit sentiment', icon: MessagesSquare },
  sector: { label: 'Sector strength', icon: Layers },
  macro_sector_impact: { label: 'Macro impact', icon: Globe2 },
  market_context: { label: 'Market context', icon: BarChart3 },
  chart_pattern: { label: 'Chart pattern', icon: LineChart },
}

function humanizeFactorName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Scores below this magnitude read as noise, not signal — treat them as flat.
const SCORE_FLAT_THRESHOLD = 0.03

type ScoreTone = 'positive' | 'negative' | 'flat'

function toneFromScore(score: number): ScoreTone {
  if (score > SCORE_FLAT_THRESHOLD) return 'positive'
  if (score < -SCORE_FLAT_THRESHOLD) return 'negative'
  return 'flat'
}

const TONE_TEXT_CLASSES: Record<ScoreTone, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  flat: 'text-muted-foreground',
}

const TONE_BAR_CLASSES: Record<ScoreTone, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  flat: 'bg-muted-foreground/40',
}

// Diverging gauge centered on zero: the fill grows left for negative scores,
// right for positive ones, so sign and magnitude both read at a glance.
function ScoreGauge({ score, tone }: { score: number; tone: ScoreTone }) {
  const magnitudePct = Math.min(100, Math.abs(score) * 100)
  return (
    <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
      <div className="bg-border absolute inset-y-0 left-1/2 w-px" />
      <div
        className={cn('absolute inset-y-0 rounded-full transition-all', TONE_BAR_CLASSES[tone])}
        style={
          score >= 0
            ? { left: '50%', width: `${magnitudePct / 2}%` }
            : { right: '50%', width: `${magnitudePct / 2}%` }
        }
      />
    </div>
  )
}

function FactorCard({ component }: { component: ComponentScoreOut }) {
  const meta = FACTOR_META[component.name]
  const Icon = meta?.icon ?? Activity
  const label = meta?.label ?? humanizeFactorName(component.name)
  const tone = toneFromScore(component.score)
  const isNotScored = component.weight === 0

  // extension_risk is a mean-reversion caution, not a routine stat — give it
  // an alert treatment when it's actually flagging pullback risk, but let it
  // sit like every other factor when the ticker isn't extended (score 0).
  const isRiskAlert = component.name === 'extension_risk' && tone === 'negative'

  return (
    <Card
      className={cn(
        isRiskAlert && 'border-amber-500/50 bg-amber-500/10 ring-amber-500/30',
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className={cn('size-4', isRiskAlert ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} />
          {label}
          {isRiskAlert && (
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Pullback risk
            </span>
          )}
        </CardTitle>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            isNotScored ? 'text-muted-foreground' : TONE_TEXT_CLASSES[tone],
          )}
        >
          {isNotScored ? 'Not scored' : formatScore(component.score)}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {!isNotScored && (
          <ScoreGauge score={component.score} tone={isRiskAlert ? 'negative' : tone} />
        )}
        <p className={cn('text-sm', isRiskAlert ? 'text-amber-900 dark:text-amber-200' : 'text-muted-foreground')}>
          {component.explanation}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * The live composite behind the header's 0-100 universe score, with the
 * action that recomputes that score. One headline number lives in the header.
 */
function CompositeScoreLine({
  ticker,
  overallScore,
  generatedAt,
}: {
  ticker: string
  overallScore: number
  generatedAt: string
}) {
  const { data, isPending } = useUniverseScore(ticker)
  const refreshUniverseScore = useRefreshUniverseScore(ticker)

  function runRefresh() {
    refreshUniverseScore.mutate(undefined, {
      onSuccess: (result) => {
        if (result.scored) {
          const newsPart = result.news_classified
            ? `, ${result.news_classified} news article${result.news_classified === 1 ? '' : 's'} classified`
            : ''
          toast.success(
            `Refreshed universe score for ${result.ticker}: ${result.score}/100${newsPart}`,
          )
        } else {
          toast.error(`Failed to refresh universe score for ${result.ticker}: ${result.error}`)
        }
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError && typeof err.detail === 'string'
            ? err.detail
            : `Failed to refresh universe score for ${ticker}`,
        )
      },
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        composite {formatScore(overallScore)} · {formatEasternDateTime(generatedAt)}
      </span>
      {!isPending && (!data || data.score === null) && (
        <span className="text-muted-foreground">Not in tracked universe — no daily universe score</span>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={refreshUniverseScore.isPending}
        onClick={runRefresh}
      >
        <RefreshCw className={cn(refreshUniverseScore.isPending && 'animate-spin')} />
        Refresh score
      </Button>
    </span>
  )
}

const POSITION_META: Record<PriceLevelPosition, { label: string; className: string }> = {
  near_support: { label: 'Near support', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  near_resistance: { label: 'Near resistance', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  mid_range: { label: 'Mid-range', className: 'bg-muted text-muted-foreground' },
  below_support: { label: 'Below usual support', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  above_resistance: { label: 'Above usual resistance', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}

const REACHABILITY_META: Record<
  ResistanceReachability,
  { label: string; className: string; explanation: string }
> = {
  reachable: {
    label: 'Reachable',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    explanation: 'Resistance is within the typical move over 5 trading sessions, based on recent volatility.',
  },
  stretch: {
    label: 'Stretch',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    explanation: 'Resistance is beyond the typical move over 5 trading sessions, but within 1.6 times that move.',
  },
  unlikely: {
    label: 'Unlikely in 5 sessions',
    className: 'bg-muted text-muted-foreground',
    explanation: 'Resistance is more than 1.6 times the typical move over 5 trading sessions away.',
  },
}

function PriceLevelsCard({ priceLevels }: { priceLevels: PriceLevelsOut }) {
  const meta = POSITION_META[priceLevels.position]
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reference price levels</CardTitle>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
            meta.className,
          )}
        >
          {meta.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Support</p>
            <p className="text-sm font-medium">
              {priceLevels.support !== null
                ? `${formatCurrency(priceLevels.support)} (${priceLevels.support_label})`
                : 'None identified'}
            </p>
          </div>
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Resistance</p>
            <p className="text-sm font-medium">
              {priceLevels.resistance !== null
                ? `${formatCurrency(priceLevels.resistance)} (${priceLevels.resistance_label})`
                : 'None identified'}
            </p>
          </div>
        </div>
        {priceLevels.expected_move_5d_pct !== null && (
          <div className="border-border rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">Typical move</p>
            <p className="text-sm font-medium">
              ±{priceLevels.expected_move_1d_pct?.toFixed(1)}% (1 trading session) · ±
              {priceLevels.expected_move_5d_pct.toFixed(1)}% (5 trading sessions) · ±
              {priceLevels.expected_move_7d_pct?.toFixed(1)}% (7 trading sessions)
              {priceLevels.atr_pct !== null && (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  ·{' '}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="About average true range"
                        className="cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        ATR {priceLevels.atr_pct.toFixed(1)}%
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Average true range (ATR) measures the typical daily price range,
                      including gaps from the previous close, over the last 14 trading
                      sessions. ATR distance describes how far away a level is, not
                      how many sessions it will take to reach it.
                    </TooltipContent>
                  </Tooltip>
                </span>
              )}
            </p>
            {priceLevels.distance_to_resistance_pct !== null &&
              priceLevels.resistance_distance_atr != null &&
              priceLevels.resistance_reachability !== null && (
                <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span>
                    Resistance is {priceLevels.distance_to_resistance_pct >= 0 ? '+' : ''}
                    {priceLevels.distance_to_resistance_pct.toFixed(1)}% away ·{' '}
                    {priceLevels.resistance_distance_atr.toFixed(1)} ATR away
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex cursor-help items-center rounded-full px-2 py-0.5 text-xs font-medium underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          REACHABILITY_META[priceLevels.resistance_reachability].className,
                        )}
                      >
                        {REACHABILITY_META[priceLevels.resistance_reachability].label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {REACHABILITY_META[priceLevels.resistance_reachability].explanation}{' '}
                      These labels describe distance relative to volatility; they do
                      not predict that price will reach resistance.
                    </TooltipContent>
                  </Tooltip>
                </p>
              )}
          </div>
        )}
        <p className="text-muted-foreground text-sm">{priceLevels.note}</p>
        <p className="text-muted-foreground text-xs">
          Reference levels only, not a recommendation to buy or sell.
        </p>
      </CardContent>
    </Card>
  )
}

const RATING_BAR_META: {
  key: keyof Pick<AnalystDetailOut, 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'>
  label: string
  barClassName: string
  dotClassName: string
}[] = [
  { key: 'strong_buy', label: 'Strong buy', barClassName: 'bg-emerald-600', dotClassName: 'bg-emerald-600' },
  { key: 'buy', label: 'Buy', barClassName: 'bg-emerald-400', dotClassName: 'bg-emerald-400' },
  { key: 'hold', label: 'Hold', barClassName: 'bg-muted-foreground/40', dotClassName: 'bg-muted-foreground/40' },
  { key: 'sell', label: 'Sell', barClassName: 'bg-red-400', dotClassName: 'bg-red-400' },
  { key: 'strong_sell', label: 'Strong sell', barClassName: 'bg-red-600', dotClassName: 'bg-red-600' },
]

function PriceTargetChangeCallout({ change }: { change: PriceTargetChangeOut }) {
  const label = actionLabel(change)
  const isDown = (change.pct_change ?? 0) < 0

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm',
        isDown
          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      )}
    >
      <Badge className={cn('border-0', ACTION_BADGE_CLASSES[label])}>{label}</Badge>
      <span className="font-medium">{change.firm}</span>
      {change.prior_price_target !== null && change.current_price_target !== null && (
        <span className="tabular-nums">
          {formatCurrency(change.prior_price_target)} → {formatCurrency(change.current_price_target)}
          {change.pct_change !== null && ` (${formatSignedPct(change.pct_change, 1)})`}
        </span>
      )}
      <span className="text-muted-foreground">{formatRelativeTime(change.action_at)}</span>
    </div>
  )
}

// action_at is a full timestamp, except in the brief cold-cache fallback,
// where it is a plain "YYYY-MM-DD" date with no time at all.
function actionDate(actionAt: string): string {
  return actionAt.includes('T') ? formatEasternDate(actionAt) : formatDate(actionAt)
}

function actionTime(actionAt: string): string | null {
  return actionAt.includes('T') ? formatEasternTime(actionAt) : null
}

function AnalystDetailCard({ ticker, detail }: { ticker: string; detail: AnalystDetailOut }) {
  // The persisted ledger (analyst_price_target_events, via
  // analyst_price_target_scan + every ticker-page visit's own force_refresh)
  // is strictly deeper than detail.recent_actions -- that list is capped at 5
  // and reflects only the single most recent live yfinance fetch. Falls back
  // to detail.recent_actions only while the history query hasn't resolved
  // yet, so the card isn't empty on a cold cache.
  const history = useAnalystPriceTargetHistory(ticker)
  const events: PriceTargetChangeOut[] =
    history.data ??
    detail.recent_actions.map((a) => ({
      firm: a.firm,
      action_at: a.date,
      price_target_action: a.price_target_action,
      current_price_target: a.current_price_target,
      prior_price_target: a.prior_price_target,
      pct_change: null,
      action: a.action,
      from_grade: a.from_grade,
      to_grade: a.to_grade,
      is_qualifying_change: null,
    }))

  const ratingCounts = RATING_BAR_META.map((meta) => ({ ...meta, count: detail[meta.key] ?? 0 }))
  const totalRatings = ratingCounts.reduce((sum, r) => sum + r.count, 0)
  const hasTargets =
    detail.price_target_low !== null ||
    detail.price_target_mean !== null ||
    detail.price_target_median !== null ||
    detail.price_target_high !== null

  return (
    <Card id="analyst-detail-card" className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Analyst detail</CardTitle>
        {detail.num_analysts !== null && (
          <span className="text-muted-foreground text-sm">{detail.num_analysts} analysts</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {detail.recent_price_target_change && (
          <PriceTargetChangeCallout change={detail.recent_price_target_change} />
        )}

        {totalRatings > 0 && (
          <div className="space-y-2">
            <div className="border-border flex h-2.5 overflow-hidden rounded-full border">
              {ratingCounts.map(
                (r) =>
                  r.count > 0 && (
                    <div
                      key={r.key}
                      className={cn(r.barClassName)}
                      style={{ width: `${(r.count / totalRatings) * 100}%` }}
                      title={`${r.label}: ${r.count}`}
                    />
                  ),
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {ratingCounts.map(
                (r) =>
                  r.count > 0 && (
                    <span key={r.key} className="text-muted-foreground inline-flex items-center gap-1.5">
                      <span className={cn('inline-block size-2 rounded-full', r.dotClassName)} />
                      {r.label} {r.count}
                    </span>
                  ),
              )}
            </div>
          </div>
        )}

        {hasTargets && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Low</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_low)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Median</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_median)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">Mean</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_mean)}</p>
            </div>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs">High</p>
              <p className="text-sm font-medium">{formatCurrency(detail.price_target_high)}</p>
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">
              Recent rating actions
              {history.isFetching && ' · refreshing…'}
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Firm</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="text-right">Price target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event, i) => {
                    const label = actionLabel(event)
                    const grade = gradeText(event)
                    const hasTarget =
                      event.prior_price_target !== null && event.current_price_target !== null
                    const isDown = (event.pct_change ?? 0) < 0
                    const time = actionTime(event.action_at)
                    return (
                      <TableRow key={`${event.firm}-${event.action_at}-${i}`}>
                        <TableCell>
                          <div className="tabular-nums">{actionDate(event.action_at)}</div>
                          {time && (
                            <div className="text-muted-foreground text-xs tabular-nums">{time}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{event.firm}</TableCell>
                        <TableCell>
                          <Badge className={cn('border-0', ACTION_BADGE_CLASSES[label])}>
                            {label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{grade ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {hasTarget && event.prior_price_target === event.current_price_target ? (
                            <div>
                              {formatCurrency(event.current_price_target)}{' '}
                              <span className="text-muted-foreground text-xs">(unchanged)</span>
                            </div>
                          ) : hasTarget ? (
                            <>
                              <div>
                                {formatCurrency(event.prior_price_target)} →{' '}
                                {formatCurrency(event.current_price_target)}
                              </div>
                              {event.pct_change !== null && (
                                <div
                                  className={cn(
                                    'text-xs',
                                    event.is_qualifying_change
                                      ? isDown
                                        ? 'font-medium text-red-600 dark:text-red-400'
                                        : 'font-medium text-emerald-600 dark:text-emerald-400'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  {formatSignedPct(event.pct_change, 1)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const VOLATILITY_REASON_LABELS: Record<string, string> = {
  unknown_price_basis: 'price adjustment basis unknown',
  insufficient_complete_history: 'fewer than 61 complete daily closes',
  zero_variance: 'no price variation in the sample',
  no_cached_history: 'no cached daily history yet',
  source_unavailable: 'price source unavailable',
  invalid_price_values: 'invalid prices in the history',
  daily_history_stale: 'daily history is behind the latest session',
  misaligned_series: 'daily history is misaligned',
  duplicate_or_unordered_dates: 'daily history has duplicate dates',
  non_session_date: 'daily history has a non-trading date',
}

function volatilityReasonLabel(reason: string): string {
  return VOLATILITY_REASON_LABELS[reason] ?? reason.replaceAll('_', ' ')
}

function SelectedVolatilityLine({ volatility }: { volatility: SelectedVolatilityOut }) {
  const sessions = volatility.horizon_sessions
  if (volatility.move_pct === null) {
    return (
      <p className="text-muted-foreground text-sm">
        {sessions}-session volatility reference unavailable:{' '}
        {volatilityReasonLabel(volatility.reason ?? 'unavailable')}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-medium">
        Typical {sessions}-session move ±{volatility.move_pct.toFixed(2)}%
      </span>
      <span className="text-muted-foreground text-xs">
        one standard deviation · {volatility.sample_count} daily returns
        {volatility.quality.status === 'stale' ? ' · stale history' : ''}
      </span>
    </div>
  )
}

function ResearchWindowDetails({
  value,
  onChange,
  window,
  volatility,
}: {
  value: number
  onChange: (sessions: number) => void
  window: SwingWindow | null | undefined
  volatility: SelectedVolatilityOut | null | undefined
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <ResearchWindowControl value={value} onChange={onChange} className="w-56" />
        {window && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Expires {formatWindowExpiry(window.expires_at)}</p>
            <p className="text-muted-foreground text-xs">{sessionsLabel(window.horizon_sessions)}</p>
          </div>
        )}
      </div>
      {volatility && <SelectedVolatilityLine volatility={volatility} />}
      <p className="text-muted-foreground text-xs">
        The window only changes this volatility reference; it does not change the composite
        score or suggest a level is reachable within it.
      </p>
    </div>
  )
}

// Worded unlike the event card's own headline so the one-line summary never repeats it.
function windowEventsSummary(eventWindow: EventWindowOut): string {
  const count = eventWindow.events.length
  if (count === 0) {
    return eventWindow.coverage_status === 'complete' ? 'no listed events' : 'event coverage incomplete'
  }
  return count === 1 ? '1 event' : `${count} events`
}

/** One line of window context; the selector and event list open underneath it. */
function ResearchWindowBar({
  horizonSessions,
  onChange,
  open,
  onOpenChange,
  window,
  volatility,
  eventWindow,
}: {
  horizonSessions: number
  onChange: (sessions: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  window: SwingWindow | null | undefined
  volatility: SelectedVolatilityOut | null | undefined
  eventWindow: EventWindowOut | null | undefined
}) {
  const details = [
    window ? `expires ${formatWindowExpiry(window.expires_at)}` : null,
    volatility?.move_pct != null ? `typical move ±${volatility.move_pct.toFixed(1)}%` : null,
    eventWindow ? windowEventsSummary(eventWindow) : null,
  ].filter((part): part is string => part !== null)

  return (
    <details
      className="group bg-card text-card-foreground rounded-xl border"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <span>
          <span className="font-medium">{horizonSessions}-session window</span>
          <span className="text-muted-foreground">{details.map((part) => ` · ${part}`).join('')}</span>
        </span>
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        <ResearchWindowDetails
          value={horizonSessions}
          onChange={onChange}
          window={window}
          volatility={volatility}
        />
        {eventWindow && <EventWindowCard data={eventWindow} />}
      </div>
    </details>
  )
}

export function AnalysisTab({ ticker }: { ticker: string }) {
  const [extras, setExtras] = useState({ chartPattern: false })
  // Held here, above the loading return: choosing a window reloads the whole
  // tab, and the bar would otherwise come back closed under the user's hand.
  const [windowOpen, setWindowOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const capabilities = useResearchCapabilities()
  const swingEnabled = capabilities.data?.swing_research_enabled === true
  const horizonSessions = swingEnabled
    ? parseHorizonSessions(searchParams.get('horizon_sessions'))
    : undefined
  const selection = horizonSessions === undefined ? {} : { horizonSessions }
  // Waits for the capability check so a swing-enabled page fetches once, with
  // its window; a failed check falls back to the legacy request.
  const base = useAnalysis(ticker, selection, !capabilities.isPending)
  const extrasQuery = useAnalysis(
    ticker,
    { includeChartPattern: extras.chartPattern, ...selection },
    extras.chartPattern,
  )

  function handleWindowChange(sessions: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('horizon_sessions', String(sessions))
      return next
    })
  }

  if (base.isPending) return <Skeleton className="h-72 rounded-xl" />
  if (base.isError) return <ErrorState error={base.error} onRetry={() => base.refetch()} />
  if (!base.data) return null

  const data = extrasQuery.data ?? base.data
  const chartPatternLoading = extras.chartPattern && extrasQuery.isFetching

  function handleDetectChartPattern() {
    if (extras.chartPattern) {
      extrasQuery.refetch()
    } else {
      setExtras((e) => ({ ...e, chartPattern: true }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize',
            LEAN_COLOR_CLASSES[data.lean],
          )}
        >
          {data.lean}
        </span>
        <CompositeScoreLine
          ticker={ticker}
          overallScore={data.overall_score}
          generatedAt={data.generated_at}
        />
        <PeerRankLine peerRank={data.peer_rank} />
        <WindowRiskChip windowRisk={data.window_risk} />
      </div>

      <CapabilityNotice isError={capabilities.isError} onRetry={() => void capabilities.refetch()} />
      {horizonSessions !== undefined && (
        <ResearchWindowBar
          horizonSessions={horizonSessions}
          onChange={handleWindowChange}
          open={windowOpen}
          onOpenChange={setWindowOpen}
          window={data.research_window}
          volatility={data.selected_volatility}
          eventWindow={data.event_window}
        />
      )}

      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Score factors · sorted by impact
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...data.components]
            .sort(
              (a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight),
            )
            .map((component) => (
              <FactorCard key={component.name} component={component} />
            ))}
        </div>
      </div>

      {data.price_levels && <PriceLevelsCard priceLevels={data.price_levels} />}
      {data.analyst_detail && <AnalystDetailCard ticker={ticker} detail={data.analyst_detail} />}
      <ScoreHistoryChart ticker={ticker} />
      <ShortInterestCard shortInterest={data.short_interest} />
      <ChartPatternCard
        ticker={ticker}
        chartPattern={data.chart_pattern}
        isLoading={chartPatternLoading}
        isError={extras.chartPattern && extrasQuery.isError}
        onDetect={handleDetectChartPattern}
      />

      {data.caveats.length > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          {data.caveats.map((caveat, i) => (
            <p key={i}>⚠ {caveat}</p>
          ))}
        </div>
      )}
    </div>
  )
}
