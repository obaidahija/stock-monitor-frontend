import {
  Activity,
  AlertTriangle,
  AtSign,
  BarChart3,
  Building2,
  CalendarClock,
  Globe2,
  Layers,
  LineChart,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime, formatScore } from '@/lib/format'
import { LEAN_COLOR_CLASSES } from '@/lib/lean-colors'
import { cn } from '@/lib/utils'
import { ChartPatternCard } from './chart-pattern-card'
import { ForecastCard } from './forecast-card'
import { useAnalysis, useRefreshUniverseScore, useUniverseScore } from './hooks'
import { SentimentTrendChart } from './sentiment-trend-chart'
import type { AnalystDetailOut, AnalysisLean, PriceLevelPosition, PriceLevelsOut } from '@/types/api'

const FACTOR_META: Record<string, { label: string; icon: LucideIcon }> = {
  fundamentals: { label: 'Fundamentals', icon: Building2 },
  momentum: { label: 'Momentum', icon: Activity },
  extension_risk: { label: 'Extension risk', icon: AlertTriangle },
  analyst_sentiment: { label: 'Analyst sentiment', icon: Users },
  earnings: { label: 'Earnings', icon: CalendarClock },
  news_sentiment: { label: 'News sentiment', icon: Newspaper },
  social_sentiment: { label: 'Social sentiment', icon: MessageCircle },
  twitter_sentiment: { label: 'Twitter/X sentiment', icon: AtSign },
  sector: { label: 'Sector strength', icon: Layers },
  macro_sector_impact: { label: 'Macro impact', icon: Globe2 },
  market_context: { label: 'Market context', icon: BarChart3 },
  chart_pattern: { label: 'Chart pattern', icon: LineChart },
  kronos_forecast: { label: 'Kronos forecast', icon: Sparkles },
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

function FactorCard({ component }: { component: { name: string; score: number; explanation: string } }) {
  const meta = FACTOR_META[component.name]
  const Icon = meta?.icon ?? Activity
  const label = meta?.label ?? humanizeFactorName(component.name)
  const tone = toneFromScore(component.score)

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
        <span className={cn('text-sm font-semibold tabular-nums', TONE_TEXT_CLASSES[tone])}>
          {formatScore(component.score)}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <ScoreGauge score={component.score} tone={isRiskAlert ? 'negative' : tone} />
        <p className={cn('text-sm', isRiskAlert ? 'text-amber-900 dark:text-amber-200' : 'text-muted-foreground')}>
          {component.explanation}
        </p>
      </CardContent>
    </Card>
  )
}

function UniverseScoreBadge({ ticker }: { ticker: string }) {
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

  const refreshButton = (
    <Button
      size="sm"
      variant="outline"
      disabled={refreshUniverseScore.isPending}
      onClick={runRefresh}
    >
      <RefreshCw className={cn(refreshUniverseScore.isPending && 'animate-spin')} />
      Refresh score
    </Button>
  )

  if (isPending) return null

  if (!data || data.score === null) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          Not in tracked universe — no daily universe score
        </span>
        {refreshButton}
      </span>
    )
  }

  const leanClass = data.lean
    ? (LEAN_COLOR_CLASSES[data.lean as AnalysisLean] ?? LEAN_COLOR_CLASSES.neutral)
    : LEAN_COLOR_CLASSES.neutral

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
          leanClass,
        )}
      >
        Universe score {data.score.toFixed(0)}/100
      </span>
      <span className="text-muted-foreground text-xs">
        updated {formatRelativeTime(data.score_updated_at)}
      </span>
      {refreshButton}
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

function AnalystDetailCard({ detail }: { detail: AnalystDetailOut }) {
  const ratingCounts = RATING_BAR_META.map((meta) => ({ ...meta, count: detail[meta.key] ?? 0 }))
  const totalRatings = ratingCounts.reduce((sum, r) => sum + r.count, 0)
  const hasTargets =
    detail.price_target_low !== null ||
    detail.price_target_mean !== null ||
    detail.price_target_median !== null ||
    detail.price_target_high !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Analyst detail</CardTitle>
        {detail.num_analysts !== null && (
          <span className="text-muted-foreground text-sm">{detail.num_analysts} analysts</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
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

        {detail.recent_actions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">Recent rating actions</p>
            <div className="space-y-1">
              {detail.recent_actions.map((action, i) => (
                <div
                  key={i}
                  className="border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b py-1 text-sm last:border-b-0"
                >
                  <span className="font-medium">{action.firm}</span>
                  <span className="text-muted-foreground text-xs">
                    {action.from_grade && action.to_grade
                      ? `${action.from_grade} → ${action.to_grade}`
                      : action.to_grade ?? action.action ?? '—'}
                    {' · '}
                    {formatDate(action.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalysisTab({ ticker }: { ticker: string }) {
  const [extras, setExtras] = useState({ chartPattern: false, forecast: false })
  const base = useAnalysis(ticker)
  const extrasQuery = useAnalysis(
    ticker,
    { includeChartPattern: extras.chartPattern, includeForecast: extras.forecast },
    extras.chartPattern || extras.forecast,
  )

  if (base.isPending) return <Skeleton className="h-72 rounded-xl" />
  if (base.isError) return <ErrorState error={base.error} onRetry={() => base.refetch()} />
  if (!base.data) return null

  const data = extrasQuery.data ?? base.data
  const chartPatternLoading = extras.chartPattern && extrasQuery.isFetching
  const forecastLoading = extras.forecast && extrasQuery.isFetching

  function handleDetectChartPattern() {
    if (extras.chartPattern) {
      extrasQuery.refetch()
    } else {
      setExtras((e) => ({ ...e, chartPattern: true }))
    }
  }

  function handleGenerateForecast() {
    if (extras.forecast) {
      extrasQuery.refetch()
    } else {
      setExtras((e) => ({ ...e, forecast: true }))
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
        <span className="text-muted-foreground text-sm">
          Overall score {formatScore(data.overall_score)} · generated {formatDateTime(data.generated_at)}
        </span>
        <UniverseScoreBadge ticker={ticker} />
      </div>

      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Score factors · sorted by impact
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...data.components]
            .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
            .map((component) => (
              <FactorCard key={component.name} component={component} />
            ))}
        </div>
      </div>

      {data.price_levels && <PriceLevelsCard priceLevels={data.price_levels} />}
      {data.analyst_detail && <AnalystDetailCard detail={data.analyst_detail} />}
      <ChartPatternCard
        ticker={ticker}
        chartPattern={data.chart_pattern}
        isLoading={chartPatternLoading}
        isError={extras.chartPattern && extrasQuery.isError}
        onDetect={handleDetectChartPattern}
      />
      <ForecastCard
        ticker={ticker}
        forecast={data.forecast}
        isLoading={forecastLoading}
        isError={extras.forecast && extrasQuery.isError}
        onGenerate={handleGenerateForecast}
      />

      <SentimentTrendChart ticker={ticker} />

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
