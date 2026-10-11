import type { ShortSqueezeItemOut } from '@/types/short-squeeze'
import { formatDate } from '@/lib/format'

export const SHORT_SQUEEZE_RULE =
  'Short float >7% + days to cover >5 + (>7% gain OR close at/above prior high)'

export function formatShortFloat(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`
}

export function formatDaysToCover(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1)
}

/** Traded volume of the completed session against its prior 20 sessions. */
export function completedSessionVolume(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Completed session volume unavailable'
    : `Completed session volume ${value.toFixed(2)}x`
}

export function readableReason(reason: string): string {
  if (reason === 'high_listing_too_young') return 'Insufficient listing history (252 sessions required)'
  if (reason === 'short_float_estimated') return 'Estimated short float (shares short ÷ float shares)'
  return reason.replaceAll('_', ' ')
}

export function shortMetadataWarning(item: ShortSqueezeItemOut): string | null {
  const reason = item.conditions.short_float.reason ?? item.conditions.days_to_cover.reason
  if (reason === 'short_report_date_stale') {
    return `Short-interest report is stale${item.short_report_date ? ` (${formatDate(item.short_report_date)})` : ''}; values are unusable`
  }
  if (reason?.startsWith('short_metadata_') || reason?.startsWith('short_report_date_')) {
    return `Short-interest values are unusable: ${readableReason(reason)}`
  }
  return null
}

export function shortReportLabel(item: ShortSqueezeItemOut): string {
  if (!item.short_report_date) return 'Short-interest report date unavailable'
  const age = item.short_report_age_days
  const ageLabel = age === null || age === undefined
    ? ''
    : ` · ${age} ${age === 1 ? 'day' : 'days'} old`
  return `Short-interest report date ${formatDate(item.short_report_date)}${ageLabel}`
}

export function shortInterestSourceLabel(item: ShortSqueezeItemOut): string {
  const provider = item.short_interest_provider
  if (provider === 'nasdaq') return 'Short-interest source: Nasdaq'
  if (provider === 'cboe') return 'Short-interest source: Cboe'
  if (provider === 'yfinance') return 'Short-interest source: Yahoo Finance'
  return 'Short-interest source unavailable'
}

/** An advisory about age, not a claim that a newer report is available. */
export function shortReportAgeWarning(item: ShortSqueezeItemOut): string | null {
  const age = item.short_report_age_days
  if (!item.short_report_date || age === null || age === undefined || age < 21 || shortMetadataWarning(item)) {
    return null
  }
  return `Older short-interest report: ${age} days old. A recent fetch does not update its report date.`
}

/**
 * Which price branch qualified the session; both are named when both passed.
 * Rule v2 needs a close at or above the prior high; stored v1 rows counted a touch.
 */
export function matchedConditionLabel(item: ShortSqueezeItemOut): string {
  const { daily_gain: gainCondition, high_close: closeCondition, high_touch: touchCondition } = item.conditions
  const gain = gainCondition.state === 'pass'
  const high = (closeCondition ?? touchCondition)?.state === 'pass'
  const highLabel = closeCondition ? 'closed at prior high' : 'prior high touched'
  if (gain && high) return `Daily gain + ${highLabel}`
  if (gain) return 'Daily gain'
  if (high) return highLabel.charAt(0).toUpperCase() + highLabel.slice(1)
  return '—'
}

/** The session reached the prior high intraday but closed below it. */
export function closedBelowHigh(item: ShortSqueezeItemOut): boolean {
  return (
    item.high_touched === true &&
    item.close_gap_to_high_pct !== null &&
    item.close_gap_to_high_pct < 0
  )
}
