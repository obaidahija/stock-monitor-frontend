import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getResearchSubscriptions,
  subscribeResearch,
  unsubscribeResearch,
} from '@/api/research-subscriptions'
import { ApiError } from '@/lib/api-client'
import type { SameTimeVolumeOut } from '@/types/api'

const easternTime = (value: string) =>
  `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))} ET`

/** A same-time ratio always states its cutoff and sample; gaps say why. */
export function sameTimeVolumeLabel(volume: SameTimeVolumeOut): string {
  if (volume.status === 'ok' && volume.value !== null && volume.cutoff_at) {
    return `${volume.value.toFixed(2)}x same-time volume through ${easternTime(volume.cutoff_at)} · ${volume.sample_sessions} prior sessions (5-minute bars)`
  }
  if (volume.status === 'stale') {
    return `Same-time volume stale: 5-minute bars ${volume.lag_minutes ?? '?'} min behind`
  }
  if (volume.reason === 'insufficient_baseline_sessions') {
    return `Same-time volume unavailable: ${volume.sample_sessions} of ${volume.minimum_sessions} comparable sessions`
  }
  return `Same-time volume unavailable: ${(volume.reason ?? 'no data').replaceAll('_', ' ')}`
}

export function intradayErrorMessage(error: unknown): string {
  const code =
    error instanceof ApiError ? (error.detail as { code?: string } | null)?.code : undefined
  if (code === 'intraday_symbol_capacity') return 'Intraday collection is at its 100-symbol limit'
  if (code === 'research_intraday_disabled') return 'Intraday collection is switched off'
  if (code === 'origin_not_active') return 'This track or catalyst is no longer active'
  return 'Could not change intraday collection'
}

export function useResearchSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: ['research-subscriptions'],
    queryFn: getResearchSubscriptions,
    enabled,
    staleTime: 60_000,
  })
}

export function useIntradayToggle() {
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['research-subscriptions'] })
    void client.invalidateQueries({ queryKey: ['discover', 'fresh-catalysts'] })
  }
  const subscribe = useMutation({ mutationFn: subscribeResearch, onSuccess: refresh })
  const unsubscribe = useMutation({ mutationFn: unsubscribeResearch, onSuccess: refresh })
  return { subscribe, unsubscribe }
}
