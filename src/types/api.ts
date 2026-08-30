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
  industry: string | null
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
  pe_ratio: number | null
  catalyst: string | null
  quote_updated_at: string | null
  recent_pattern: ChartPatternDetail | null
}

export interface SectorSummaryOut {
  sector: string
  avg_change_pct: number | null
  count: number
  advancers: number
  decliners: number
  top_ticker: string | null
  top_ticker_change_pct: number | null
}

export interface SectorHeatmapOut {
  items: SectorSummaryOut[]
  total_tickers: number
  unclassified_tickers: number
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

export interface YfEarningsEventOut {
  event_date: string
  bmo_amc: string
  eps_estimate: number | null
  eps_actual: number | null
}

export interface EarningsSummary {
  ticker: string
  next: EarningsEventOut | null
  history: EarningsEventOut[]
  yfinance_snapshot: YfEarningsEventOut[]
}

export interface EarningsReactionSourceOut {
  ok: boolean
  error: string | null
}

export interface EarningsReactionPointOut {
  offset: number
  avg_pct: number
  min_pct: number
  max_pct: number
  n: number
}

export interface EarningsReactionEventPointOut {
  offset: number
  pct: number
}

export interface EarningsReactionEventOut {
  event_date: string
  bmo_amc: string
  eps_estimate: number | null
  eps_actual: number | null
  points: EarningsReactionEventPointOut[]
}

export interface EarningsReactionOut {
  ticker: string
  before_days: number
  after_days: number
  points: EarningsReactionPointOut[]
  events: EarningsReactionEventOut[]
  events_used: number
  days_until_next_earnings: number | null
  source: EarningsReactionSourceOut
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

export interface NewsSummaryRefreshResult {
  skipped?: boolean
  attempted: number
  generated: number
  failed: number
}

export interface NewsRefreshResult {
  ticker: string
  new: number
  duplicates: number
  filtered_irrelevant: number
  errors: { source: string; error: string }[]
  ai_summaries: NewsSummaryRefreshResult
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

export interface TwitterBestStockOut {
  rank: number
  ticker: string
  unique_authors: number
  unique_posts: number
  representative_views: number
  sentiment_score: number | null
  company_name: string | null
  symbols: {
    ticker: string
  }[]
}

export interface TwitterBestStocksOut {
  items: TwitterBestStockOut[]
  generated_at: string | null
  window_started_at: string | null
  window_ended_at: string | null
  qualified_sample_size: number
  searches_attempted: number
  searches_succeeded: number
  phrases_covered: number
  phrases_total: number
  refresh_active: boolean
  active_run_id: string | null
  stale: boolean
  stale_reason: string | null
}

export interface TwitterBestStocksRefreshOut {
  run_id: string
  status: string
  reused: boolean
}

export interface RedditTopMentionOut {
  rank: number
  ticker: string
  mention_count: number
  unique_authors: number
  recommendation_count: number
  news_count: number
  analysis_count: number
  other_count: number
  general_count: number
  untyped_count: number
  sentiment_score: number | null
  sentiment_positive_count: number
  sentiment_negative_count: number
  sentiment_neutral_count: number
  max_signal_score: number | null
  company_name: string | null
  symbols: {
    ticker: string
  }[]
}

export interface RedditTopMentionsOut {
  items: RedditTopMentionOut[]
  generated_at: string | null
  window_started_at: string | null
  window_ended_at: string | null
  qualified_sample_size: number
  refresh_active: boolean
  active_run_id: string | null
  stale: boolean
  stale_reason: string | null
}

export interface RedditTopMentionsRefreshOut {
  run_id: string
  status: string
  reused: boolean
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

export interface PriceReferenceOut {
  entry_primary: number | null
  entry_secondary: number | null
  stop_loss: number | null
  take_profit: number | null
  note: string
}

export interface AiResearchInputsOut {
  news_item_ids: number[]
  news_item_count: number
  twitter_post_ids: string[]
  twitter_post_count: number
  twitter_cache_is_fresh: boolean
  twitter_cache_age_seconds: number | null
  reddit_post_ids: string[]
  reddit_post_count: number
  reddit_cache_is_fresh: boolean
  reddit_cache_age_seconds: number | null
  quant_facts: string[]
}

export interface AiResearchSourceOut {
  ok: boolean
  error: string | null
}

export interface AiResearchOut {
  snapshot_id: number | null
  ticker: string
  score: number | null
  confidence: number | null
  lean: AnalysisLean | null
  summary: string | null
  key_drivers: string[]
  risks: string[]
  price_reference: PriceReferenceOut | null
  inputs_used: AiResearchInputsOut
  caveat: string
  source: AiResearchSourceOut
  generated_at: string
  cached: boolean
  current_price: number | null
  usage?: LlmUsageSummaryOut | null
}

export type AiProvider = 'ollama' | 'llamacpp' | 'anthropic' | 'openrouter'

export interface LlmUsageSummaryOut {
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
  cached_tokens: number
  cost_usd: string | null
}

export interface ResearchAiProfile {
  provider: AiProvider
  model: string
  reasoning_enabled: boolean
  streaming_enabled: boolean
  include_chart: boolean
}

export interface SummarizationAiProfile {
  provider: AiProvider
  model: string
}

export interface AiSettingsOut {
  research: ResearchAiProfile
  summarization: SummarizationAiProfile
  providers: Record<AiProvider, { configured: boolean; default_model: string }>
  updated_at: string
}

export interface AiSettingsUpdate {
  research: ResearchAiProfile
  summarization: SummarizationAiProfile
}

export interface OpenRouterModelOut {
  id: string
  name: string
  context_length: number | null
  input_modalities: string[]
  output_modalities: string[]
  supported_parameters: string[]
  prompt_price: string | null
  completion_price: string | null
}

export interface AiConversationMessageOut {
  id: number
  role: 'user' | 'assistant'
  content: string
  attachment_names: string[]
  status: 'complete' | 'failed'
  created_at: string
  usage?: LlmUsageSummaryOut | null
}

export interface AiConversationSummaryOut {
  id: number
  ticker: string
  provider: AiProvider
  model: string
  reasoning_enabled: boolean
  streaming_enabled: boolean
  title: string | null
  created_at: string
  updated_at: string
}

export interface AiConversationOut extends AiConversationSummaryOut {
  messages: AiConversationMessageOut[]
  usage: LlmUsageSummaryOut | null
}

export type ResearchStreamEvent =
  | { event: 'started'; data: { conversation_id: number; provider: string; model: string } }
  | { event: 'thinking'; data: { active: boolean } }
  | { event: 'text_delta'; data: { text: string } }
  | { event: 'attachment'; data: { name: string; status: string } }
  | { event: 'usage'; data: LlmUsageSummaryOut }
  | {
      event: 'completed'
      data: { message: AiConversationMessageOut; finish_reason: string | null }
    }
  | { event: 'error'; data: { code: string | number; message: string; retryable: boolean } }

export type WatchlistSetupSide = 'long' | 'short'
export type WatchlistSetupHorizon = 'short_term' | 'long_term' | 'custom'
export type WatchlistSetupSource = 'ai_managed' | 'manual'
export type WatchlistSetupStatus = 'active' | 'expired' | 'superseded'

export interface WatchlistOut {
  id: number
  name: string
  item_count: number
  contains_ticker: boolean
  membership_id: number | null
  has_setup: boolean
  created_at: string
  updated_at: string
}

export interface WatchlistMembershipOut {
  watchlist_id: number
  watchlist_name: string
  item_id: number
  ticker: string
  has_setup: boolean
}

export interface AiResearchBriefOut {
  snapshot_id: number
  score: number | null
  confidence: number | null
  lean: string | null
  summary: string | null
  key_drivers: string[]
  risks: string[]
  price_reference_note: string | null
  generated_at: string
}

export interface LevelDistanceOut {
  entry_primary: number | null
  entry_secondary: number | null
  stop_loss: number | null
  take_profit: number | null
}

export interface WatchlistSetupOut {
  id: number
  watchlist_item_id: number
  ticker: string
  side: WatchlistSetupSide
  horizon: WatchlistSetupHorizon
  expires_on: string
  source_mode: WatchlistSetupSource
  status: WatchlistSetupStatus
  is_current: boolean
  entry_primary: number
  entry_secondary: number | null
  stop_loss: number
  take_profit: number
  note: string | null
  research_snapshot_id: number | null
  levels_snapshot_id: number | null
  needs_review: boolean
  sync_error: string | null
  research: AiResearchBriefOut | null
  created_at: string
  updated_at: string
  superseded_at: string | null
}

export interface WatchlistItemOut {
  id: number
  watchlist_id: number
  ticker: string
  company_name: string | null
  created_at: string
  current_price: number | null
  session_price: number | null
  quote_updated_at: string | null
  market_session: 'overnight' | 'pre_market' | 'regular' | 'post_market' | 'closed' | null
  distance_pct: LevelDistanceOut | null
  current_setup: WatchlistSetupOut | null
  event_count: number
  active_event_count: number
  has_event_delivery_failure: boolean
}

export type WatchlistEventComparison = 'lte' | 'gte'
export type WatchlistEventState = 'active' | 'triggered' | 'disabled'
export type WatchlistSetupLevel =
  | 'entry_primary'
  | 'entry_secondary'
  | 'stop_loss'
  | 'take_profit'

export interface WatchlistEventConditionOut {
  kind: 'custom' | 'setup_level'
  comparison: WatchlistEventComparison
  threshold_price: number
  setup_id: number | null
  level: WatchlistSetupLevel | null
}

export interface WatchlistEventOccurrenceOut {
  id: number
  observed_price: number
  market_session: 'pre_market' | 'regular' | 'post_market'
  quote_at: string
  triggered_at: string
  delivery_status: 'pending' | 'retrying' | 'sent' | 'failed'
  delivery_attempts: number
  last_error: string | null
  sent_at: string | null
}

export interface WatchlistEventOut {
  id: number
  watchlist_item_id: number
  ticker: string
  event_type: 'price_threshold'
  state: WatchlistEventState
  condition: WatchlistEventConditionOut
  message: string | null
  activation_version: number
  triggered_at: string | null
  disabled_at: string | null
  disabled_reason: string | null
  last_occurrence: WatchlistEventOccurrenceOut | null
  created_at: string
  updated_at: string
}

export interface TelegramStatusOut {
  configured: boolean
  ready: boolean
  error: string | null
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

export interface ChartPatternDetail {
  label: string
  confidence: number
  bias: string
  description: string
  date_start?: string
  date_end?: string
  price_start?: number
  price_end?: number
}

export interface DigestItem {
  ticker: string
  tier: number
  reasons: string[]
  stages: string[]
  premarket: DigestPremarket | null
  premarket_gap_pct: number | null
  volume_ratio: number | null
  pct_from_12wk_avg: number | null
  recent_pattern: ChartPatternDetail | null
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
  sweep_post_limit: number
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
  tweet_type: string | null
  tweet_type_score: number | null
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
}

export type RedditAuthState = 'checking' | 'valid' | 'missing' | 'invalid' | 'unavailable'
export type RedditOperationStatus = 'queued' | 'running' | 'deferred' | 'succeeded' | 'failed'
export type RedditFeedFilter = 'all' | 'trusted' | 'viral'
export type RedditSort = 'signal' | 'newest' | 'virality' | 'score' | 'comments'
export type RedditListingSort = 'new' | 'hot' | 'top' | 'rising'
export type RedditTimeFilter = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
export type RedditCommentSort = 'best' | 'top' | 'new' | 'controversial' | 'old' | 'qa'

export interface RedditQueueCounts {
  queued: number
  running: number
  deferred: number
  failed: number
}

export interface RedditAuthStateOut {
  state: RedditAuthState
  checked_at: string | null
  username: string | null
  public_message: string | null
  cooldown_until: string | null
  public_reads_available: boolean
}

export interface RedditHealthOut {
  enabled: boolean
  auto_reauth_enabled: boolean
  worker_running: boolean
  auth: RedditAuthStateOut
  queue: RedditQueueCounts
}

export interface RedditOperationOut {
  id: string
  kind: string
  scope_key: string | null
  priority: number
  status: RedditOperationStatus
  attempt: number
  max_attempts: number
  available_at: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  public_error_code: string | null
  public_error_message: string | null
}

export interface RedditTickerMatchOut {
  ticker: string
  match_kind: 'cashtag' | 'context_symbol' | 'company_alias'
  matched_text: string
  confidence: number
}

export interface RedditMetricsOut {
  score: number
  num_comments: number
}

export interface RedditSignalPenaltyOut {
  rule_id: 'stickied' | 'excessive_tickers' | 'bot_author' | 'near_duplicate'
  points: number
  explanation: string
}

export interface RedditSignalScoreOut {
  version: string
  relevance_score: number
  sentiment_strength_score: number
  engagement_velocity_score: number
  discussion_quality_score: number
  source_trust_score: number
  penalty_score: number
  final_score: number
  virality_score: number
  penalties: RedditSignalPenaltyOut[]
}

export interface RedditPostOut {
  id: string
  fullname: string
  title: string
  selftext: string
  subreddit: string
  author: string
  created_at: string
  permalink: string
  url: string
  score: number
  num_comments: number
  metrics: RedditMetricsOut
  is_self: boolean
  over_18: boolean
  is_video: boolean
  stickied: boolean
  is_trusted: boolean
  is_viral: boolean
  content_state: 'visible' | 'deleted' | 'removed' | 'unavailable'
  ticker_matches: RedditTickerMatchOut[]
  signal_score: RedditSignalScoreOut | null
  sentiment_label: string | null
  sentiment_confidence: number | null
  post_type: string | null
  post_type_score: number | null
}

export interface RedditCommentOut {
  id: string
  fullname: string
  post_id: string
  parent_fullname: string
  author: string
  body: string
  score: number
  created_at: string
  depth: number
  tree_order: number
  content_state: 'visible' | 'deleted' | 'removed' | 'unavailable'
  ticker_matches: RedditTickerMatchOut[]
  sentiment_label: string | null
  sentiment_confidence: number | null
}

export interface RedditSearchResultOut {
  items: RedditPostOut[]
  sentiment_pending: boolean
  generated_at: string
  cache_age_seconds: number | null
  operation: RedditOperationOut | null
  stale: boolean
  stale_reason: string | null
}

export interface RedditPageOut {
  items: RedditPostOut[]
  sentiment_pending: boolean
  total: number
  page: number
  page_size: number
  generated_at: string
  stale: boolean
  reason: string | null
}

export interface RedditThreadOut {
  post: RedditPostOut
  comments: RedditCommentOut[]
  generated_at: string
  stale: boolean
  stale_reason: string | null
  operation: RedditOperationOut | null
}

export interface RedditTrustedSubredditOut {
  name: string
  enabled: boolean
  default_sort: RedditListingSort
  post_limit: number | null
  last_successful_fetch_at: string | null
  operation: RedditOperationOut | null
}

export interface RedditTrustedAuthorOut {
  username: string
  enabled: boolean
  last_successful_fetch_at: string | null
  operation: RedditOperationOut | null
}

export interface RedditFeedRefreshOut {
  subreddit_operations: RedditOperationOut[]
  author_operations: RedditOperationOut[]
}

export interface RedditAuthRecheckOut {
  auth: RedditAuthStateOut
  operation: RedditOperationOut | null
}

export interface MacroNewsItemOut {
  id: number
  source: string
  url: string
  title: string
  summary: string | null
  categories: string[]
  sentiment_label: string | null
  sentiment_score: number | null
  published_at: string
  classification_pending: boolean
}

export interface MacroCategorySignal {
  count: number
  avg_sentiment_score: number | null
}

export interface MacroSignalOut {
  window_hours: number
  total_items: number
  categories: Record<string, MacroCategorySignal>
  generated_at: string
}

export type MacroBucketGranularity = 'hour' | 'day'

export interface MacroSignalHistoryBucketOut {
  bucket_start: string
  total: number
  categories: Record<string, number>
}

export interface MacroSectorImpactItemOut {
  id: number
  title: string
  url: string
  category: string
  via_category: string | null
  direction: 'positive' | 'negative'
  stance: string
  magnitude: string
  direction_note: string
}

export interface MacroSectorImpactBucketOut {
  positive_count: number
  negative_count: number
  net: 'positive' | 'negative' | 'mixed' | 'neutral'
  items: MacroSectorImpactItemOut[]
}

export interface MacroSectorImpactOut {
  impact_date: string
  window_hours: number
  items_considered: number
  items_resolved: number
  sectors: Record<string, MacroSectorImpactBucketOut>
  generated_at: string
}

export interface MacroSectorImpactDateOut {
  impact_date: string
  generated_at: string
}

export interface TrendingSymbolOut {
  ticker: string
}

export interface TrendingTwitterOut {
  rank: number
  unique_authors: number
  unique_posts: number
  representative_views: number
  sentiment_score: number | null
}

export interface TrendingRedditOut {
  rank: number
  mention_count: number
  unique_authors: number
  sentiment_score: number | null
  max_signal_score: number | null
}

export interface TrendingSparklinePointOut {
  date: string
  twitter_unique_authors: number | null
  reddit_mention_count: number | null
}

export interface TrendingTickerOut {
  ticker: string
  company_name: string | null
  symbols: TrendingSymbolOut[]
  sector: string | null
  price: number | null
  change_pct: number | null
  twitter: TrendingTwitterOut | null
  reddit: TrendingRedditOut | null
  combined_score: number
  appeared_days: number
  is_new_entrant: boolean
  sparkline: TrendingSparklinePointOut[]
}

export interface TrendingSectorSparklinePointOut {
  captured_at: string
  trend_pct: number
}

export interface TrendingSectorTopTickerOut {
  ticker: string
  company_name: string | null
  price: number | null
  change_pct: number | null
}

export interface TrendingSectorOut {
  sector: string
  ticker_count: number
  combined_score: number
  top_tickers: TrendingSectorTopTickerOut[]
  avg_change_pct: number | null
  etf_symbol: string | null
  etf_trend_pct: number | null
  etf_sparkline: TrendingSectorSparklinePointOut[]
}

export interface TrendingSentimentOverviewOut {
  bullish_count: number
  bearish_count: number
  neutral_count: number
}

export interface TrendingPlatformOverlapOut {
  twitter_only: number
  reddit_only: number
  both: number
}

export interface TrendingSourceStatusOut {
  name: string
  ok: boolean
  fetched_at: string | null
  stale: boolean
  stale_reason: string | null
}

export interface TrendingSummaryOut {
  generated_at: string
  general_lookback_days: number
  today: TrendingTickerOut[]
  general: TrendingTickerOut[]
  new_entrants: TrendingTickerOut[]
  sectors: TrendingSectorOut[]
  sentiment_overview: TrendingSentimentOverviewOut
  platform_overlap: TrendingPlatformOverlapOut
  sources: TrendingSourceStatusOut[]
}
