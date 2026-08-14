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
  is_archived: boolean
  archived_at: string | null
}

export interface TickerSearchResult {
  ticker: string
  company_name: string | null
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
  news_classified: number
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
  ai_summary: string | null
  published_at: string
  fetched_at: string
  sentiment_label: string | null
  sentiment_score: number | null
  sentiment_classified_at: string | null
}

export interface NewsClusterDetailOut extends NewsClusterOut {
  items: NewsItemOut[]
}

export interface NewsItemExtractOut {
  id: number
  ai_summary: string | null
  cached: boolean
  error: string | null
}

export interface NewsRefreshResult {
  ticker: string
  new: number
  duplicates: number
  filtered_irrelevant: number
  errors: { source: string; error: string }[]
  score: UniverseScoreRefreshResult | null
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

export interface AnalystActionOut {
  firm: string
  action: string | null
  from_grade: string | null
  to_grade: string | null
  date: string
}

export interface AnalystDetailOut {
  strong_buy: number | null
  buy: number | null
  hold: number | null
  sell: number | null
  strong_sell: number | null
  price_target_low: number | null
  price_target_high: number | null
  price_target_mean: number | null
  price_target_median: number | null
  num_analysts: number | null
  recent_actions: AnalystActionOut[]
}

export interface AnalysisOut {
  ticker: string
  lean: AnalysisLean
  overall_score: number
  components: ComponentScoreOut[]
  price_levels: PriceLevelsOut | null
  analyst_detail: AnalystDetailOut | null
  chart_pattern: ChartPatternOut | null
  forecast: ForecastOut | null
  caveats: string[]
  generated_at: string
}

export type ChartPatternBias = 'bullish' | 'bearish' | 'neutral'

export interface DetectedPatternOut {
  label: string
  confidence: number
  bbox: number[]
  bias: ChartPatternBias
  description: string
}

export interface ChartPatternSourceOut {
  ok: boolean
  error: string | null
}

export interface ChartPatternOut {
  ticker: string
  patterns: DetectedPatternOut[]
  annotated_image_base64: string | null
  caveat: string
  generated_at: string
  source: ChartPatternSourceOut
}

export interface ForecastPointOut {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ForecastSourceOut {
  ok: boolean
  error: string | null
}

export interface ForecastOut {
  ticker: string
  lookback_days: number
  pred_len_days: number
  points: ForecastPointOut[]
  forecast_return_pct: number | null
  chart_image_base64: string | null
  caveat: string
  generated_at: string
  source: ForecastSourceOut
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

export interface TwitterQueueCounts {
  queued: number
  running: number
  deferred: number
}

export type TwitterAuthState =
  | 'checking'
  | 'valid'
  | 'missing'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'

export interface TwitterHealthOut {
  worker_running: boolean
  auth_state: TwitterAuthState
  cooldown_until: string | null
  queue: TwitterQueueCounts
}

export interface HealthResponse {
  status: string
  scheduler_running: boolean
  sources: SourceStatus[]
  twitter: TwitterHealthOut
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

// --- Job progress (mirrors app/schemas/job_progress.py) ---

export type JobProgressStatus = 'started' | 'progress' | 'completed' | 'failed'

export interface JobProgressEvent {
  job_name: string
  status: JobProgressStatus
  processed: number
  total: number
  errors: number
  message: string | null
  ts: string
}

// --- Twitter (mirrors app/schemas/twitter.py) ---

export interface TwitterAuthStateOut {
  state: TwitterAuthState
  checked_at: string | null
  public_message: string | null
  cooldown_until: string | null
}

export type TwitterOperationStatus = 'queued' | 'running' | 'deferred' | 'succeeded' | 'failed'

export interface TwitterOperationOut {
  id: string
  kind: string
  status: TwitterOperationStatus
  priority: number
  attempts: number
  max_attempts: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  public_error_code: string | null
  public_error_message: string | null
}

export interface TwitterAuthRecheckOut {
  auth: TwitterAuthStateOut
  operation: TwitterOperationOut | null
}

export type TwitterTrustedAccountStatus = 'pending' | 'active' | 'invalid'

export interface TwitterTrustedAccountOut {
  id: number
  x_user_id: string | null
  username: string
  status: TwitterTrustedAccountStatus
  validation_started_at: string | null
  validated_at: string | null
  public_error_code: string | null
  public_error_message: string | null
  operation: TwitterOperationOut | null
}

export interface TwitterTrustedAccountCreateOut {
  account: TwitterTrustedAccountOut
  operation: TwitterOperationOut
}

export interface TwitterPostMetricsOut {
  views: number
  likes: number
  retweets: number
  replies: number
  quotes: number
  bookmarks: number
}

export interface TwitterTickerMatchOut {
  ticker: string
  match_kind: string
  relevance_points: number
}

export interface TwitterRiskRuleMatchOut {
  rule_id: string
  penalty_points: number
  explanation: string
}

export interface TwitterSignalExplanationOut {
  component: string
  explanation: string
}

export interface TwitterViralityBreakdownOut {
  view_points: number
  action_points: number
  velocity_points: number
  prior_snapshot_captured_at: string | null
}

export interface TwitterSignalScoreOut {
  version: string
  calculated_at: string
  relevance_score: number
  virality_score: number
  source_trust_score: number
  freshness_score: number
  corroboration_score: number
  risk_penalty_score: number
  final_score: number
  virality_breakdown: TwitterViralityBreakdownOut
  corroborating_sources: string[]
  matched_risk_rules: TwitterRiskRuleMatchOut[]
  explanations: TwitterSignalExplanationOut[]
}

export interface TwitterPostOut {
  id: string
  text: string
  author_id: string
  author_username: string
  author_name: string
  author_verified: boolean
  created_at: string
  url: string
  ticker_matches: TwitterTickerMatchOut[]
  metrics: TwitterPostMetricsOut
  is_trusted: boolean
  is_viral: boolean
  link_domains: string[]
  signal_score: TwitterSignalScoreOut | null
  sentiment_label: string | null
  sentiment_score: number | null
}

export interface TwitterSearchResultOut {
  items: TwitterPostOut[]
  cache_fetched_at: string | null
  cache_age_seconds: number | null
  operation: TwitterOperationOut | null
  stale: boolean
  stale_reason: string | null
}

export interface TwitterPageOut {
  items: TwitterPostOut[]
  total: number
  page: number
  page_size: number
  generated_at: string
  stale: boolean
  reason: string | null
}

export interface TwitterFeedRefreshOut {
  trusted_operations: TwitterOperationOut[]
  viral_operations: TwitterOperationOut[]
}
