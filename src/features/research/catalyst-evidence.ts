import { apiClient } from '@/lib/api-client'

export type EvidenceClock = 'publication' | 'first_seen'

export interface HistoricalContext {
  status: 'ok' | 'no_controls' | 'unavailable'
  as_of: string | null
  version: string | null
  observations: number
  paired_observations: number
  event_rate: number | null
  control_rate: number | null
  overlapping_observations: number
}

export interface EvidenceWindow {
  horizon: number
  status: string
  ends_at: string
  stock_close: number | null
  stock_pct: number | null
  spy_pct: number | null
  excess_pct: number | null
  excess_atr: number | null
  mean_volume_ratio: number | null
  other_detected_events: number | null
  history: HistoricalContext
}

export interface CatalystEvidence {
  candidate_id: number
  ticker: string
  category: string
  clock: EvidenceClock
  generated_at: string
  anchor_at: string
  published_at: string
  first_seen_at: string
  detection_lag_hours: number
  original_article_status: string
  issuer_event_status: string
  original_article_on: string | null
  issuer_event_on: string | null
  status: string
  baseline_session: string | null
  reaction_session: string | null
  baseline_close: number | null
  prior_atr: number | null
  intraday_anchor: boolean
  pre_5_session_excess_pct: number | null
  timeline: Array<{
    offset: number
    session: string
    close_at: string
    stock_close: number
    spy_close: number
    stock_pct: number
    spy_pct: number
  }>
  windows: EvidenceWindow[]
  limits: string[]
}

export function getCatalystEvidence(candidateId: number, clock: EvidenceClock) {
  return apiClient.get<CatalystEvidence>(`/v1/discover/catalysts/${candidateId}/evidence?clock=${clock}`)
}
