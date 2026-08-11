// Mirrors app/schemas/*.py in the stock-monitor backend, field-for-field.

export interface TrackedTickerOut {
  id: number
  ticker: string
  company_name: string | null
  is_manual: boolean
  note: string | null
  added_at: string
  score: number | null
  lean: string | null
  score_updated_at: string | null
  sector: string | null
}

export type EarningsResult = 'beat' | 'miss' | 'inline'

export interface UniverseTickerOut extends TrackedTickerOut {
  next_earnings_date: string | null
  next_earnings_bmo_amc: string | null
  last_earnings_result: EarningsResult | null
  last_earnings_surprise_pct: number | null
  is_reit: boolean
  price: number | null
  change_pct: number | null
  volume: number | null
  avg_volume_20d: number | null
  volume_ratio: number | null
  catalyst: string | null
  quote_updated_at: string | null
}

export interface FilingOut {
  id: number
  ticker: string | null
  cik: string | null
  accession_number: string
  form_type: string
  filed_at: string
  filing_url: string
  title: string | null
  item_codes: string | null
  is_notable: boolean
  source: string
}

export interface EarningsEventOut {
  id: number
  ticker: string
  event_date: string
  bmo_amc: string
  eps_estimate: number | null
  eps_actual: number | null
  revenue_estimate: number | null
  revenue_actual: number | null
}

export interface EarningsSummary {
  ticker: string
  next: EarningsEventOut | null
  history: EarningsEventOut[]
}

export interface EarningsRefreshResult {
  ticker: string
  new: number
  updated: number
  error: string | null
}

export interface UniverseScoreRefreshResult {
  ticker: string
  scored: boolean
  score?: number
  lean?: string
  error?: string
}

export interface NewsClusterOut {
  id: number
  ticker: string | null
  representative_title: string
  first_seen_at: string
  last_seen_at: string
  source_count: number
  item_count: number
  sources: string[]
  sentiment_label: string | null
  sentiment_net_score: number | null
}

export interface NewsItemOut {
  id: number
  source: string
  url: string
  title: string
  summary: string | null
  published_at: string
  fetched_at: string
  sentiment_label: string | null
  sentiment_score: number | null
  sentiment_classified_at: string | null
}

export interface NewsClusterDetailOut extends NewsClusterOut {
  items: NewsItemOut[]
}

export interface NewsRefreshResult {
  ticker: string
  new: number
  duplicates: number
  filtered_irrelevant: number
  errors: { source: string; error: string }[]
}

export interface CatalystOut {
  catalyst_type: string
  event_date: string
  description: string | null
  source: string
}

export interface ComponentScoreOut {
  name: string
  score: number
  explanation: string
}

export interface SocialStatOut {
  ticker: string
  source: string
  snapshot_at: string
  buzz_score: number | null
  mentions: number | null
  sentiment_score: number | null
  bullish_pct: number | null
  bearish_pct: number | null
  trend: string | null
}

export interface TrendingSocialOut {
  ticker: string
  source: string
  buzz_score: number | null
  mentions: number | null
  sentiment_score: number | null
  trend: string | null
}

export type AnalysisLean = 'bullish' | 'neutral' | 'bearish'

export type PriceLevelPosition =
  | 'near_support'
  | 'near_resistance'
  | 'mid_range'
  | 'below_support'
  | 'above_resistance'

export interface PriceLevelsOut {
  support: number | null
  support_label: string
  resistance: number | null
  resistance_label: string
  position: PriceLevelPosition
  note: string
}

export interface AnalysisOut {
  ticker: string
  lean: AnalysisLean
  overall_score: number
  components: ComponentScoreOut[]
  price_levels: PriceLevelsOut | null
  caveats: string[]
  generated_at: string
}

export interface GapperOut {
  ticker: string
  price: number | null
  change_pct: number | null
  volume: number | null
  catalyst: string | null
}

export interface UnusualVolumeOut {
  ticker: string
  volume: number | null
  avg_volume_20d: number | null
  volume_ratio: number
}

export type SentimentBucketGranularity = 'hour' | 'day' | 'week'

export interface SentimentBucketOut {
  bucket_start: string
  avg_net_score: number | null
  item_count: number
  positive_count: number
  negative_count: number
  neutral_count: number
}

export interface SentimentHistoryOut {
  ticker: string
  bucket: SentimentBucketGranularity
  buckets: SentimentBucketOut[]
}

// Raw dict shapes produced by digest_service.py (backend only types `payload` as `dict`).
export interface DigestPremarket {
  price: number | null
  change_pct: number | null
  volume: number | null
}

export interface DigestTopFiling {
  form_type: string
  filed_at: string
  url: string
}

export interface DigestTopEarnings {
  event_date: string
  bmo_amc: string
}

export interface DigestSentiment {
  label: string | null
  net_score: number | null
  cluster_title: string
}

export interface DigestItem {
  ticker: string
  tier: number
  reasons: string[]
  premarket: DigestPremarket | null
  top_filing: DigestTopFiling | null
  top_earnings: DigestTopEarnings | null
  news_count_24h: number
  headline_snippets: string[]
  sentiment: DigestSentiment | null
}

export interface DigestPayload {
  digest_date: string
  generated_at: string
  items: DigestItem[]
}

export interface DigestOut {
  digest_date: string
  generated_at: string
  payload: DigestPayload
}

export type DigestItemOut = DigestItem

export interface SourceStatus {
  name: string
  ok: boolean
  fetched_at: string | null
  error: string | null
  latency_ms: number | null
}

export interface HealthResponse {
  status: string
  scheduler_running: boolean
  sources: SourceStatus[]
}

export interface JobInfo {
  name: string
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
}

export interface JobRunResult {
  job_run_id: number
  status: string
  detail: Record<string, unknown> | null
  error: string | null
}
