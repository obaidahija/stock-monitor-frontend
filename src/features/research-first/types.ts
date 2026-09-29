import type { SelectedVolatilityOut, SwingWindow } from '@/types/api'

export interface ResearchFirstItem {
  rank: number
  ticker: string
  company_name: string | null
  candidate_id: number | null
  headline: string
  category: string
  event_status?: 'reported' | 'tentative' | 'scheduled'
  published_at: string | null
  original_article_on?: string | null
  original_article_status?: 'unknown' | 'verified' | 'unavailable'
  original_article_evidence_url?: string | null
  issuer_event_on?: string | null
  issuer_event_status?: 'unknown' | 'verified' | 'unavailable'
  issuer_event_evidence_url?: string | null
  source_url: string | null
  source_name: string | null
  priority_points: number
  ranking: { label: string; points: number }[]
  composite_score: number | null
  lean: string | null
  score_updated_at: string | null
  observed_direction: 'up' | 'down' | 'flat' | null
  reaction_atr: number | null
  volume_ratio: number | null
  reaction_observed_at: string | null
  earnings_date: string | null
  earnings_timing: string | null
  earnings_overlap: 'inside' | 'possible_overlap' | null
  selected_volatility: SelectedVolatilityOut | null
  supporting_evidence: string[]
  risks: string[]
  data_limits: string[]
}

export interface ResearchFirstReport {
  rule_version: string
  generated_at: string
  window: SwingWindow
  eligible_tickers: number
  coverage: { status?: string; reason?: string }
  collection_enabled: boolean
  items: ResearchFirstItem[]
}
