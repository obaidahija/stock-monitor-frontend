import type { FilingKeyFact } from './api'

export interface ConsensusComparison {
  reported: number
  basis: 'reported' | 'gaap' | 'adjusted'
  estimate: number
  difference: number
  surprise_pct: number | null
  result: 'beat' | 'miss' | 'in_line'
  basis_note?: string
}

export interface GuidanceComparison {
  value: string
  basis: 'reported' | 'gaap' | 'adjusted' | null
  period: string | null
  low: number
  midpoint: number
  high: number
  estimate: number
  /** Where consensus sits relative to the company's range. */
  position: 'below' | 'within' | 'above'
  midpoint_vs_estimate_pct: number | null
  /** EPS guidance not stated on an adjusted basis, while consensus usually is. */
  basis_note?: string
}

/** Results and guidance against consensus, using a saved snapshot when available. */
export interface EarningsEstimates {
  eps?: ConsensusComparison
  revenue?: ConsensusComparison
  guidance?: { eps?: GuidanceComparison; revenue?: GuidanceComparison }
  following_event_date?: string | null
  /** When the consensus snapshot was captured, if available. */
  consensus_captured_at?: string | null
  /** Results or guidance stated in another currency; consensus is in USD. */
  not_compared?: { metric: 'eps' | 'revenue' | 'guidance_eps' | 'guidance_revenue'; reason: string }[]
}

export interface ConsensusView {
  event_date: string
  eps_estimate: number | null
  revenue_estimate: number | null
}

/** An earnings filing read by the app's release extractor (Filing Intel earnings_result). */
export interface EarningsResultOut {
  key_facts: FilingKeyFact[]
  omitted_key_facts?: number
  reported_quarter?: string | null
  summary?: string
  /** Consensus snapshot saved by Filing Intel. */
  consensus?: { current: ConsensusView | null; following: ConsensusView | null; captured_at?: string | null }
  estimates?: EarningsEstimates | null
}
