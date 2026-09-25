import { ApiError } from '@/lib/api-client'
import type { WatchlistSetupOut } from '@/types/api'

export const RESEARCH_WINDOW_OPTIONS = [1, 3, 5, 7] as const
export const DEFAULT_RESEARCH_WINDOW = 5

/** A URL/form value as a selectable session count; anything else is 5. */
export function parseHorizonSessions(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_RESEARCH_WINDOW
  const value = Number(raw)
  return (RESEARCH_WINDOW_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_RESEARCH_WINDOW
}

/** The server-resolved expiry instant, shown in exchange time. */
export function formatWindowExpiry(expiresAt: string): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(expiresAt))
    // Newer ICU builds put a narrow no-break space before AM/PM.
    .replace(/\u202f/g, ' ')
  return `${formatted} ET`
}

/** True for the 503 a disabled swing feature returns; never worth retrying. */
export function isSwingDisabledError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 503) return false
  const detail = error.detail as { code?: string } | null
  return detail?.code === 'swing_research_disabled'
}

export function sessionsLabel(count: number): string {
  return count === 1 ? '1 trading session' : `${count} trading sessions`
}

const LEGACY_HORIZON_LABELS: Record<string, string> = {
  short_term: 'Short term',
  long_term: 'Long term',
  custom: 'Custom',
}

/** "Swing · 3 trading sessions" for a swing setup; the legacy label otherwise. */
export function setupHorizonLabel(setup: Pick<WatchlistSetupOut, 'horizon' | 'horizon_sessions'>) {
  if (setup.horizon === 'swing' && setup.horizon_sessions) {
    return `Swing · ${sessionsLabel(setup.horizon_sessions)}`
  }
  return LEGACY_HORIZON_LABELS[setup.horizon] ?? setup.horizon
}

/** The exact exchange-time expiry of a swing setup; the saved date otherwise. */
export function setupExpiryLabel(setup: Pick<WatchlistSetupOut, 'expires_on' | 'window'>) {
  return setup.window ? formatWindowExpiry(setup.window.expires_at) : setup.expires_on
}
