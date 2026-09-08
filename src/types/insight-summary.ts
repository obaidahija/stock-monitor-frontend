import type { LlmUsageSummaryOut } from './api'

export type InsightSignal = 'positive' | 'negative' | 'neutral' | 'mixed'
export type InsightConfidence = 'high' | 'medium' | 'low'
export type InsightPolarity = 'positive' | 'negative' | 'neutral'
export type InsightMateriality = 'high' | 'medium' | 'low'

export type InsightEvidenceRef =
  | {
      kind: 'commitment_event'
      commitment_id: number
      event_id: number
      document_id: number
      block_id: string
      quote: string
    }
  | {
      kind: 'filing_change'
      comparison_id: number
      cluster_id: string
      finding_ids: string[]
      section: 'risk_factors' | 'mda'
    }

export interface InsightFactorOut {
  id: string
  polarity: InsightPolarity
  materiality: InsightMateriality
  title: string
  detail: string
  evidence_refs: InsightEvidenceRef[]
}

export interface InsightFactOut {
  label: string
  value: string
  context: string | null
}

export interface InsightCoverageOut {
  status: 'complete' | 'partial' | 'insufficient'
  included: string[]
  excluded: string[]
  notices: string[]
}

export interface InsightSummaryOut {
  status: 'ready' | 'partial' | 'unavailable'
  signal: InsightSignal | null
  confidence: InsightConfidence | null
  headline: string
  explanation: string
  key_positives: InsightFactorOut[]
  key_negatives: InsightFactorOut[]
  key_neutral: InsightFactorOut[]
  key_facts: InsightFactOut[]
  coverage: InsightCoverageOut
  generated_at: string
  stale: boolean
  analysis_version: string
  usage: LlmUsageSummaryOut | null
}
