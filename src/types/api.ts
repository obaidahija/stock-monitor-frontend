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

export interface ScoreHistoryPointOut {
  captured_on: string
  score: number
  lean: string | null
}

// What the filing says about why a transaction happened. `plan_unspecified`
// is deliberately distinct from `ten_b5_1`: the filing's checkbox was set but
// it never said which of its transactions the plan covered.
export type InsiderTransactionIntent =
  | 'ten_b5_1'
  | 'plan_unspecified'
  | 'tax_withholding'
  | 'other_non_discretionary'
  | 'unclassified'

export type InsiderIntentBasis =
  | 'linked_footnote'
  | 'single_transaction_remarks'
  | 'document_checkbox'
  | 'none'

export interface ReportingOwnerOut {
  name: string
  cik: string | null
  title: string | null
  is_officer: boolean
  is_director: boolean
  is_ten_percent_owner: boolean
}

export interface InsiderDataQualityWarningOut {
  code: string
  message: string
  affected_accessions: string[]
  excluded_event_count: number
}

export interface InsiderTransactionOut {
  insider_name: string
  insider_title: string | null
  is_officer: boolean
  is_director: boolean
  is_ten_percent_owner: boolean
  transaction_code: string | null
  transaction_date: string | null
  shares: number | null
  price_per_share: number | null
  value_usd: number | null
  shares_owned_after: number | null
  security_title: string | null
  is_derivative: boolean
  is_10b5_1: boolean
  filed_at: string | null
  source_url: string | null
  // Additive provenance. Optional throughout: a generation-1 response omits
  // all of it and the table still renders.
  accession_number?: string | null
  issuer_trading_symbol?: string | null
  ticker_resolution_method?: string | null
  reporting_owners?: ReportingOwnerOut[] | null
  transaction_intent?: InsiderTransactionIntent | null
  intent_basis?: InsiderIntentBasis | null
  plan_adoption_date?: string | null
  is_amendment?: boolean
  amends_accession?: string | null
  is_superseded?: boolean
}

export interface InsiderSummaryOut {
  ticker: string
  lookback_days: number
  buy_count: number
  buy_value_usd: number
  sell_count: number
  sell_value_usd: number
  distinct_buyers: number
  net_value_usd: number
  cluster_buy: boolean
  officer_buying: boolean
  latest_transaction_date: string | null
  // Declared for fidelity with the API and deliberately not rendered: the
  // analysis tab already shows the insider factor with a plain-language
  // reason, and a second number invites "which one is right?".
  signal_score: number | null
  // Zero means the insider factor carries no weight at all, which is a
  // different statement from a score of zero.
  scoreable_event_count?: number
  planned_event_count?: number
  tax_withholding_event_count?: number
  unclassified_event_count?: number
  excluded_ambiguous_event_count?: number
  data_quality_warnings?: InsiderDataQualityWarningOut[]
}

export interface InsiderOut {
  summary: InsiderSummaryOut
  transactions: InsiderTransactionOut[]
}

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
  score_change_1d: number | null
  score_change_5d: number | null
  insider_cluster_buy: boolean
  insider_buy_value_usd: number | null
  short_percent_of_float: number | null
  float_shares: number | null
  /** From universe_score; sizes ticker boxes in the sector map. */
  market_cap?: number | null
  sector_score_percentile: number | null
  industry_score_percentile: number | null
}

export interface ShortInterestOut {
  short_percent_of_float: number | null
  short_ratio: number | null
  float_shares: number | null
  held_percent_institutions: number | null
  held_percent_insiders: number | null
}

export interface PeerRankOut {
  group_kind: 'sector' | 'industry'
  group_label: string
  rank: number
  group_size: number
  percentile: number
}

export interface QuoteOut {
  ticker: string
  price: number | null
  change_amount: number | null
  change_pct: number | null
  regular_market_time: string | null
  session_price: number | null
  session_change_amount: number | null
  session_change_pct: number | null
  market_session: 'overnight' | 'pre_market' | 'regular' | 'post_market' | 'closed' | null
  session_time: string | null
}

export interface IndustrySummaryOut {
  industry: string
  avg_change_pct: number | null
  count: number
  advancers: number
  decliners: number
  top_ticker: string | null
  top_ticker_change_pct: number | null
}

export interface SectorSummaryOut {
  sector: string
  avg_change_pct: number | null
  count: number
  advancers: number
  decliners: number
  top_ticker: string | null
  top_ticker_change_pct: number | null
  /** Largest first; empty from a backend that predates industry breakdowns. */
  industries?: IndustrySummaryOut[]
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
  eps_comparison_available?: boolean
  eps_comparison_actual?: number | null
  eps_comparison_estimate?: number | null
  eps_comparison_basis?: string | null
  eps_comparison_source_url?: string | null
}

export interface YfEarningsEventOut {
  eps_comparison_available?: boolean
  eps_comparison_actual?: number | null
  eps_comparison_estimate?: number | null
  eps_comparison_basis?: string | null
  eps_comparison_source_url?: string | null
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
  pe_ratio: number | null
  volume_ratio: number | null
  is_upcoming: boolean
  eps_comparison_available?: boolean
  eps_comparison_actual?: number | null
  eps_comparison_estimate?: number | null
  eps_comparison_basis?: string | null
  eps_comparison_source_url?: string | null
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
  today_offset: number | null
  current_pe_ratio: number | null
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
  event_category: string | null
  is_material: boolean
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
  event_category: string | null
  is_material: boolean
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
  weight: number
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

export type ResistanceReachability = 'reachable' | 'stretch' | 'unlikely'

export interface PriceLevelsOut {
  support: number | null
  support_label: string
  resistance: number | null
  resistance_label: string
  position: PriceLevelPosition
  note: string
  atr_pct: number | null
  expected_move_1d_pct: number | null
  expected_move_5d_pct: number | null
  expected_move_7d_pct: number | null
  distance_to_resistance_pct: number | null
  resistance_distance_atr: number | null
  resistance_reachability: ResistanceReachability | null
}

export interface WindowRiskOut {
  level: 'high' | 'medium'
  days: number
  earnings_date: string | null
  earnings_bmo_amc: string | null
  days_until_earnings: number | null
  macro_events: string[]
  note: string
}

export interface AnalystActionOut {
  firm: string
  action: string | null
  from_grade: string | null
  to_grade: string | null
  date: string
  price_target_action: string | null
  current_price_target: number | null
  prior_price_target: number | null
}

export interface PriceTargetChangeOut {
  firm: string
  action_at: string
  price_target_action: string | null
  current_price_target: number | null
  prior_price_target: number | null
  pct_change: number | null
  // Populated on every item from GET .../analyst-price-target-history;
  // optional because analyst_detail.recent_price_target_change (the single
  // highlight) predates these fields.
  action?: string | null
  from_grade?: string | null
  to_grade?: string | null
  is_qualifying_change?: boolean | null
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
  recent_price_target_change: PriceTargetChangeOut | null
}

export interface PriceTargetChangeSummaryOut {
  ticker: string
  firm: string
  action_at: string
  price_target_action: string | null
  current_price_target: number | null
  prior_price_target: number | null
  pct_change: number | null
  current_price: number | null
  upside_to_target_pct: number | null
}

/** A fixed 1-7 exchange-session research window, resolved by the server. */
export interface SwingWindow {
  starts_at: string
  anchor_session: string
  horizon_sessions: number
  /** Close of the last session in the window -- the exact expiry instant. */
  expires_at: string
  expires_on: string
  calendar: 'XNYS'
  window_version: string
}

export type DataQualityStatus = 'ok' | 'partial' | 'stale' | 'unavailable'

export interface DataQualitySourceOut {
  name: string
  source_url?: string | null
  status: string
  observed_at?: string | null
  fetched_at?: string | null
}

export interface DataQuality {
  status: DataQualityStatus
  /** Market observation time; null when there is no observation. */
  as_of: string | null
  /** Retrieval time -- never a substitute for as_of. */
  fetched_at: string | null
  sources: DataQualitySourceOut[]
  reasons: string[]
  price_basis: 'raw' | 'split_adjusted' | 'unknown'
  market_session: 'regular' | 'pre_market' | 'post_market' | 'closed' | null
}

export interface SelectedVolatilityOut {
  horizon_sessions: number
  move_pct: number | null
  sample_count: number
  reason: string | null
  quality: DataQuality
}

export interface WindowEventOut {
  canonical_key: string
  event_type: string
  title: string
  local_date: string
  start_at: string
  end_at: string
  precision: 'exact' | 'bmo' | 'amc' | 'date_only'
  overlap: 'inside' | 'possible_overlap' | 'after_expiry'
  severity: 'high' | 'elevated' | 'informational'
  status: 'scheduled' | 'awaiting_confirmation' | 'occurred'
  verification: string
  source_name: string
  source_url: string | null
  timing_reasons: string[]
}

export interface EventWindowOut {
  window: SwingWindow
  events: WindowEventOut[]
  near_after_expiry: WindowEventOut[]
  highest_severity: WindowEventOut['severity'] | null
  coverage_status: 'complete' | 'partial' | 'stale' | 'unavailable'
  coverage_sources: Array<{
    source_key: string
    status: string
    coverage_start: string | null
    coverage_end: string | null
    last_success_at: string | null
    reason: string | null
  }>
  conflicts: Record<string, unknown>[]
  evaluated_at: string
  collection_enabled: boolean
  historical_knowledge: boolean
}

export interface CatalystReactionOut {
  observed_at: string
  price_basis: 'quote' | 'completed_close'
  observed_price: number | null
  reaction_pct: number | null
  reaction_atr: number | null
  volume_ratio: number | null
  extension: 'small' | 'moderate' | 'extended' | null
  direction: 'up' | 'down' | 'flat' | null
  elevated_volume: boolean | null
  reasons: Record<string, string>
}

export interface FreshCatalystOut {
  candidate_id: number
  ticker: string
  event: {
    headline: string
    source_url: string | null
    source_name: string | null
    category: string
    published_at: string | null
    first_seen_at: string
    time_status: 'eligible' | 'expired' | 'time_uncertain' | 'future_timestamp'
  }
  pre_event_close: number | null
  daily_reaction: CatalystReactionOut | null
  latest_quote_reaction: CatalystReactionOut | null
  quality: { status: string; reasons: string[] }
  observation_id: number | null
  /** Optional intraday extension; null while it is switched off. */
  intraday?: CatalystIntradayOut | null
}

export interface FreshCatalystsPage {
  items: FreshCatalystOut[]
  total: number
  generated_at: string | null
  coverage: { status: string; reason?: string }
  rule_version: string
  collection_enabled: boolean
}

export interface AnalysisOut {
  ticker: string
  lean: AnalysisLean
  overall_score: number
  components: ComponentScoreOut[]
  price_levels: PriceLevelsOut | null
  window_risk: WindowRiskOut | null
  analyst_detail: AnalystDetailOut | null
  chart_pattern: ChartPatternOut | null
  short_interest: ShortInterestOut | null
  peer_rank: PeerRankOut | null
  /** Present only when a research window was requested. */
  research_window?: SwingWindow | null
  selected_volatility?: SelectedVolatilityOut | null
  event_window?: EventWindowOut | null
  caveats: string[]
  generated_at: string
}

export interface ResearchCapabilitiesOut {
  swing_research_enabled: boolean
  research_outcomes_v2_enabled: boolean
  catalyst_scanner_enabled: boolean
  follow_through_enabled: boolean
  event_window_v2_enabled: boolean
  research_intraday_enabled: boolean
}

export type FollowThroughCreate =
  | { origin: 'setup'; setup_revision_id: number }
  | { origin: 'catalyst'; candidate_id: number; horizon_sessions: number }

export interface FollowThroughTrackOut {
  id: number
  origin: 'setup' | 'catalyst'
  ticker: string
  setup_id: number | null
  side: ResearchSide
  setup_revision_id: number | null
  source_candidate_id: number | null
  observation_id: number | null
  started_at: string
  expected_baseline_at: string
  baseline_session: string
  baseline_status: 'pending' | 'available' | 'missing'
  baseline_price: number | null
  benchmark_symbol: string
  benchmark_label: string
  benchmark_baseline_price: number | null
  window: Record<string, unknown>
  levels: Record<string, number | null>
  evidence: Record<string, unknown>
  lifecycle: 'active' | 'completed' | 'stopped' | 'superseded'
  ended_at: string | null
  end_reason: string | null
  rule_version: string
}

export interface FollowThroughSessionOut {
  session_date: string
  observed_at: string
  recorded_at: string
  close: number | null
  benchmark_close: number | null
  metrics: {
    status: string
    stock_return_pct: number | null
    benchmark_return_pct: number | null
    raw_excess_pct: number | null
    side_aligned_excess_pct: number | null
    reference_distance_atr: number | null
    volume_ratio: number | null
    reasons: string[]
  }
  quality: { status: string; reasons: string[]; stock?: string; benchmark?: string }
  evidence: Record<string, unknown>
  rule_version: string
  revision: number
}

export interface FollowThroughDetailOut {
  track: FollowThroughTrackOut
  rows: FollowThroughSessionOut[]
  quality: { status: string }
}

export interface FollowThroughListOut {
  items: FollowThroughTrackOut[]
  total: number
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

export interface GoogleFinanceResearchSourceOut {
  title: string
  publisher: string | null
  url: string
}

export interface GoogleFinanceResearchOut {
  ticker: string
  question: string
  answer_markdown: string | null
  sources: GoogleFinanceResearchSourceOut[]
  generated_at: string
  caveat: string
  source: SourceStatus
}

export interface GoogleFinanceChatTurnIn {
  question: string
  answer: string
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
  context_window_tokens: number
  reasoning_enabled: boolean
  streaming_enabled: boolean
  include_chart: boolean
}

export interface SummarizationAiProfile {
  provider: AiProvider
  model: string
  context_window_tokens: number
}

export interface BackgroundAiProfile {
  provider: AiProvider
  model: string
  max_tokens: number
  context_window_tokens: number
}

export interface AiSettingsOut {
  research: ResearchAiProfile
  summarization: SummarizationAiProfile
  macro_transmission: BackgroundAiProfile
  providers: Record<
    AiProvider,
    { configured: boolean; default_model: string; default_context_window_tokens: number }
  >
  updated_at: string
}

export interface AiSettingsUpdate {
  research: ResearchAiProfile
  summarization: SummarizationAiProfile
  macro_transmission: BackgroundAiProfile
}

// The three profiles that share the provider/model/max_tokens shape, keyed the
// same way the API is.
export type BackgroundAiProfileKey = 'macro_transmission'

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

export type GoogleFinanceMarketPicksHorizonKey = '1-2w' | '2-4w'

export interface GoogleFinanceMarketPickSourceOut {
  title: string
  publisher: string | null
  url: string
}

export interface GoogleFinanceMarketPickOut {
  rank: number
  ticker: string
  company_name_reported: string | null
  conviction_score: number
  explanation: string
  tracked: boolean
  composite_score: number | null
  lean: string | null
  sector: string | null
  market_cap: number | null
  current_price: number | null
  change_pct: number | null
}

export interface GoogleFinanceMarketPicksHorizonOut {
  horizon: GoogleFinanceMarketPicksHorizonKey
  horizon_label: string
  source_ok: boolean
  source_error: string | null
  fetched_at: string | null
  parse_warning: string | null
  items: GoogleFinanceMarketPickOut[]
  sources: GoogleFinanceMarketPickSourceOut[]
}

export interface GoogleFinanceMarketPicksOut {
  horizons: GoogleFinanceMarketPicksHorizonOut[]
  generated_at: string | null
  refresh_active: boolean
  active_run_id: string | null
  stale: boolean
  stale_reason: string | null
  disclaimer: string
}

export interface GoogleFinanceMarketPicksRefreshOut {
  run_id: string
  status: string
  reused: boolean
}

export interface GoogleFinanceCompetitorsOut extends GoogleFinanceResearchOut {
  snapshot_id: number | null
  cached: boolean
}

export type WatchlistSetupSide = 'long' | 'short'
export type WatchlistSetupHorizon = 'short_term' | 'long_term' | 'custom' | 'swing'
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
  /** Swing setups only; null for the calendar-day horizons. */
  horizon_sessions?: number | null
  window?: SwingWindow | null
  current_revision_id?: number | null
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

export interface SetupWindowPreviewOut {
  window: SwingWindow
  server_time: string
}

export interface WatchlistItemOut {
  id: number
  watchlist_id: number
  ticker: string
  company_name: string | null
  created_at: string
  current_price: number | null
  change_amount?: number | null
  change_pct?: number | null
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

export type WatchlistRuleType =
  | 'price'
  | 'new_filing'
  | 'earnings_in_days'
  | 'insider_cluster_buy'
  | 'score_change'
  | 'new_pattern'
  | 'pct_change'
  | 'volume_ratio'

export interface WatchlistEventOccurrenceOut {
  id: number
  /** Null for a non-price occurrence: a filing alert has no quote. */
  observed_price: number | null
  market_session: 'pre_market' | 'regular' | 'post_market' | null
  quote_at: string | null
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
  rule_type: WatchlistRuleType
  state: WatchlistEventState
  /** Null for every non-price rule. */
  condition: WatchlistEventConditionOut | null
  params: Record<string, unknown>
  last_trigger_key: string | null
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
  digest_enabled: boolean
}

export interface DigestDeliveryOut {
  digest_date: string
  slot: string
  status: string
  message_count: number
  messages_sent: number
  last_error: string | null
  skipped: boolean
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
  /** Absent on digests stored before filing prominence existed. */
  item_codes?: string | null
  prominence?: 'primary' | 'secondary'
  /** Disclosed-topic rank within prominence (4.02 highest); orders the section. */
  importance?: number
  prominence_reason?: string
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
  /** Section name; tier only orders sections. Absent on digests stored before sections. */
  section?: string
  tier: number
  /** Slow-moving sections only: whether the ticker is new since the last digest. */
  new_today?: boolean | null
  score?: number | null
  reasons: string[]
  stages: string[]
  premarket: DigestPremarket | null
  premarket_gap_pct: number | null
  volume_ratio: number | null
  pct_from_12wk_avg: number | null
  recent_pattern: ChartPatternDetail | null
  top_filing: DigestTopFiling | null
  /** Other notable filings in the same window, most substantive first. */
  supporting_filings?: DigestTopFiling[]
  top_earnings: DigestTopEarnings | null
  news_count_24h: number
  headline_snippets: string[]
  sentiment: DigestSentiment | null
}

export interface DigestPayload {
  digest_date: string
  generated_at: string
  items: DigestItem[]
  research_first?: Record<string, import('@/features/research-first/types').ResearchFirstReport>
}

export type DigestEditionName = 'early' | 'late' | 'intraday' | 'legacy'

export interface DigestOut {
  digest_date: string
  generated_at: string
  payload: DigestPayload
  /** Edition metadata; absent on responses from older backends. */
  snapshot_id?: number | null
  edition?: DigestEditionName | string | null
  capture_completed_at?: string | null
  /** An early morning edition the 09:05 build has not replaced. */
  preliminary?: boolean | null
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

export type MarketEventCategory =
  | 'oil_energy'
  | 'geopolitical_conflict'
  | 'rates_fed'
  | 'treasury_debt'
  | 'banking_credit'
  | 'trade_tariffs'
  | 'inflation'
  | 'other'

export type MarketEventStance = 'hawkish' | 'dovish' | 'neutral_inline' | 'unresolved'

export interface MarketEventSectorImpactOut {
  sector: string
  rationale: string
  predicted_direction: 'positive' | 'negative'
  via_category: string | null
  current_trend_pct: number | null
  graded: boolean
  actual_direction: 'positive' | 'negative' | 'flat' | null
  hit: boolean | null
  trend_pct_before: number | null
  trend_pct_after: number | null
}

export interface MarketEventOut {
  rank: number
  event_name: string
  event_date: string
  category: MarketEventCategory
  stance: MarketEventStance
  reason: string
  sector_impacts: MarketEventSectorImpactOut[]
}

export interface MarketEventBigEarningsOut {
  ticker: string
  sector: string | null
  event_date: string
  bmo_amc: string
  market_cap: number | null
}

export interface MarketEventsOut {
  events: MarketEventOut[]
  big_earnings: MarketEventBigEarningsOut[]
  generated_at: string | null
  refresh_active: boolean
  active_run_id: string | null
  stale: boolean
  stale_reason: string | null
  source_error: string | null
  parse_warning: string | null
  disclaimer: string
  outcome_caveat: string
}

export interface MarketEventsRefreshOut {
  run_id: string
  status: string
  reused: boolean
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

export interface LeanPerformanceOut {
  lean: string
  count: number
  hit_rate: number
  avg_excess_return_pct: number
}

export interface ScoreBucketPerformanceOut {
  bucket: string
  count: number
  hit_rate: number
  avg_excess_return_pct: number
}

export interface FactorPerformanceOut {
  factor: string
  positive_count: number
  positive_hit_rate: number | null
  negative_count: number
  negative_hit_rate: number | null
  spread: number | null
}

export interface SignalPerformanceOut {
  horizon_days: number
  evaluated_count: number
  by_lean: LeanPerformanceOut[]
  by_score_bucket: ScoreBucketPerformanceOut[]
  by_factor: FactorPerformanceOut[]
}

export interface SectorRotationEntryOut {
  etf_symbol: string
  sector: string
  trend_pct: number
  rank: number
  trend_pct_prior: number | null
  rank_prior: number | null
  /** Positive means the sector improved: rank_prior - rank, so 8 -> 3 is +5. */
  rank_change: number | null
  trend_pct_change: number | null
}

export interface SectorRotationOut {
  window_days: number
  as_of: string | null
  prior_as_of: string | null
  history_days_available: number
  caveat: string
  sectors: SectorRotationEntryOut[]
}

export interface EarningsPlaybookDriftOut {
  horizon_days: number
  mean_pct: number | null
  median_pct: number | null
  /** Per-horizon, not shared: deeper horizons have fewer usable quarters. */
  quarters: number
}

export interface EarningsPlaybookQuarterOut {
  event_date: string
  bmo_amc: string
  reaction_pct: number
  drift_1d_pct: number | null
  drift_5d_pct: number | null
  drift_20d_pct: number | null
}

export interface EarningsPlaybookOut {
  ticker: string
  reaction_quarters: number
  reaction_mean_pct: number | null
  reaction_median_pct: number | null
  reaction_mean_abs_pct: number | null
  up_count: number
  down_count: number
  direction_consistency_pct: number | null
  drift: EarningsPlaybookDriftOut[]
  quarters: EarningsPlaybookQuarterOut[]
  days_until_next_earnings: number | null
  source: { ok: boolean; error: string | null }
}

export type SettingValue = boolean | number | string

export interface SettingField {
  name: string
  label: string
  kind: 'bool' | 'int' | 'float' | 'str'
  description: string
  value: SettingValue
  default: SettingValue
  is_overridden: boolean
  requires_restart: boolean
  minimum: number | null
  maximum: number | null
}

export interface SettingsCategory {
  name: string
  label: string
  fields: SettingField[]
}

export interface SettingsOut {
  categories: SettingsCategory[]
}

// --- Prospective research outcomes (/v1/research-performance) ---

export type ResearchSourceKind = 'composite_daily' | 'catalyst' | 'follow_through'

export interface ResearchMonitoringOut {
  generated_at: string
  current_catalyst_rule_version: string
  horizon_sessions: 1 | 3 | 5 | 7
  latest_finalized_session: string | null
  bar_sessions: {
    session_date: string
    expected_symbols: number | null
    complete_symbols: number
    checkpoint_status: string | null
    checkpoint_synced: number | null
    checkpoint_coverage_pct: number | null
    attempts: number | null
    last_attempt_at: string | null
  }[]
  baseline_sessions: {
    baseline_session: string | null
    rule_version: string
    complete: number
    partial: number
  }[]
  catalyst_cohorts: {
    rule_version: string
    baseline_status: 'full' | 'partial'
    candidates: number
    daily_measured: number
    reaction_pct_n: number
    mean_reaction_pct: number | null
    reaction_atr_n: number
    mean_reaction_atr: number | null
    volume_ratio_n: number
    mean_volume_ratio: number | null
    outcomes_recorded: number
    outcomes_matured: number
    outcomes_evaluated: number
    outcomes_missing: number
    excess_return_n: number
    mean_excess_return_pct: number | null
  }[]
  usage: {
    follow_through: { total: number; active: number; started_30d: number }
    subscriptions: { total: number; enabled: number; created_30d: number; ever_succeeded: number }
    setup_revisions: {
      total: number
      created_30d: number
      manual_total: number
      manual_created_30d: number
      automated_total: number
      manual_edits: number
    }
  }
}
export type ResearchSide = 'long' | 'short' | 'unassigned'
export type ResearchOrigin = 'setup' | 'catalyst'
export type ResearchOutcomeStatus =
  | 'pending'
  | 'evaluated'
  | 'missing_data'
  | 'corporate_action_unresolved'
export type ResearchMetricName =
  | 'raw_return_pct'
  | 'side_return_pct'
  | 'cost_adjusted_return_pct'
  | 'excess_return_pct'
  | 'favorable_move_pct'
  | 'adverse_move_pct'

export interface ResearchPerformanceFilters {
  horizon_sessions: 1 | 3 | 5 | 7
  source_kind: ResearchSourceKind
  rule_version?: string
  side?: ResearchSide
  origin?: ResearchOrigin
  from?: string
  to?: string
  status?: ResearchOutcomeStatus
  extends_beyond_setup_expiry?: boolean
}

export interface ResearchCoverageOut {
  recorded: number
  matured: number
  evaluated: number
  missing: number
}

/** One metric over evaluated rows; `n` is its own denominator. */
export interface ResearchMetricOut {
  n: number
  unavailable: number
  mean: number | null
  equal_date_mean: number | null
  median: number | null
  positive: number
  zero: number
  negative: number
  positive_rate: number | null
}

export interface ResearchGroupOut {
  key: string
  coverage: ResearchCoverageOut
  decision_sessions: number
  metrics: Record<ResearchMetricName, ResearchMetricOut>
  path_order_counts?: Record<string, number>
}

export interface ResearchFactorPerformanceOut {
  factor: string
  positive: ResearchGroupOut
  zero: ResearchGroupOut
  negative: ResearchGroupOut
  missing: ResearchGroupOut
  positive_minus_negative_excess_pct: number | null
}

export interface ResearchScoreSpreadOut {
  total_sessions: number
  eligible_sessions: number
  paired_sessions: number
  top: ResearchGroupOut
  bottom: ResearchGroupOut
  mean_daily_spread_pct: number | null
  median_daily_spread_pct: number | null
}

export interface ResearchCohortOut {
  horizon_sessions: number
  source_kind: ResearchSourceKind
  rule_version: string | null
  side: ResearchSide | null
  origin: ResearchOrigin | null
  status: ResearchOutcomeStatus | null
  extends_beyond_setup_expiry: boolean | null
  from: string
  to: string
}

export interface ResearchCostProfileOut {
  name: string
  per_side_bps: number
  round_trip_bps: number
  excludes: string[]
}

export interface ResearchPerformanceOut {
  cohort: ResearchCohortOut
  measurement_definition: Record<string, string>
  costs: ResearchCostProfileOut
  coverage: ResearchCoverageOut
  corrections: number
  date_counts: { decision_sessions: number; first: string | null; last: string | null }
  provisional: boolean
  overall: ResearchGroupOut
  by_rule: ResearchGroupOut[]
  by_side: ResearchGroupOut[]
  by_score_bucket: ResearchGroupOut[]
  by_factor: ResearchFactorPerformanceOut[]
  score_spread: ResearchScoreSpreadOut | null
  by_calendar_month: ResearchGroupOut[]
  collection_enabled: boolean
  generated_at: string
}

export interface ResearchObservationRowOut {
  observation_id: number
  ticker: string
  side: ResearchSide
  origin: ResearchOrigin | null
  source_key: string
  rule_version: string
  decision_at: string
  decision_session: string
  horizon_sessions: number
  mature: boolean
  status: ResearchOutcomeStatus
  status_reason: string | null
  revision: number
  baseline_session: string
  exit_session: string
  baseline_price: number | null
  exit_price: number | null
  raw_return_pct: number | null
  side_return_pct: number | null
  cost_adjusted_return_pct: number | null
  benchmark_return_pct: number | null
  excess_return_pct: number | null
  favorable_move_pct?: number | null
  adverse_move_pct?: number | null
  path_status?: string | null
  target_stop_order?: string | null
  path_coverage?: { expected_bars: number; usable_bars: number; status: string } | null
  extends_beyond_setup_expiry: boolean | null
  headline: string | null
  score: number | null
  overall_score: number | null
  lean: string | null
}

export interface ResearchObservationPageOut {
  items: ResearchObservationRowOut[]
  total: number
  page: number
  page_size: number
}

/** Same-elapsed-time 5-minute volume ratio; never a daily volume ratio. */
export interface SameTimeVolumeOut {
  value: number | null
  status: 'ok' | 'unavailable' | 'stale'
  reason: string | null
  session?: string | null
  cutoff_at?: string | null
  lag_minutes?: number | null
  sample_sessions: number
  minimum_sessions: number
  interval: string
}

export interface CatalystIntradayOut {
  subscription_id: number | null
  collecting: boolean
  coverage: Record<string, unknown> | null
  same_time_volume: SameTimeVolumeOut | null
  pre_publication_reference: { close: number; bar_end_at: string; basis: 'reference_only' } | null
}

export type ResearchSubscriptionOrigin =
  | { follow_through_track_id: number }
  | { catalyst_candidate_id: number }

export interface ResearchSubscriptionOut {
  id: number
  origin_type: 'follow_through' | 'catalyst'
  origin_id: number
  ticker: string
  enabled: boolean
  created_at: string
  disabled_at: string | null
  last_attempt_at: string | null
  last_success_at: string | null
  coverage: {
    status?: string
    error?: string | null
    last_bar_end?: string | null
    sessions_with_gaps?: string[]
  }
}

export interface ResearchSubscriptionListOut {
  items: ResearchSubscriptionOut[]
  collection_enabled: boolean
  symbol_limit: number
}

export type StockPairStrength = 'strong' | 'moderate' | 'not_confirmed'
export type StockPairEvidenceStatus =
  | 'computed'
  | 'insufficient_data'
  | 'invalid_security'
  | 'price_unavailable'
  | 'price_stale'
  | 'undefined'
export type StockPairMarketCheckStatus = 'available' | 'unavailable' | 'undefined'
export type StockPairBusinessKind =
  | 'shared_industry'
  | 'shared_product'
  | 'shared_customer_market'
  | 'supplier_customer'
  | 'other'
// Evidence-coverage labels, not truth scores.
export type StockPairBusinessStatus = 'source_checked' | 'partial' | 'unverified'
export type StockPairClaimCheckStatus = 'matched' | 'mismatch' | 'unavailable' | 'not_checked'

/** One business fact Google proposed and what an independent retrieval of its source found. */
export interface StockPairBusinessClaimOut {
  kind: StockPairBusinessKind
  // The ticker the fact is about, or BOTH for a passage naming both companies.
  subject: string
  fact: string
  proposed_excerpt: string
  // As reported by Google, never independently extracted.
  reported_source_date: string | null
  source: GoogleFinanceResearchSourceOut
  check_status: StockPairClaimCheckStatus
  checked_excerpt: string | null
  checked_at: string | null
  // From the retrieved page's own metadata.
  source_published_at: string | null
  final_url: string | null
  content_sha256: string | null
  reason: string | null
}

export interface StockPairBusinessEvidenceOut {
  hypothesis: string
  status: StockPairBusinessStatus
  claims: StockPairBusinessClaimOut[]
  reason: string | null
}

/** One aligned daily return of each stock, as fractions (0.01 is 1%). */
export interface StockPairReturnPointOut {
  date: string
  target_return: number
  candidate_return: number
}

export interface StockPairScatterOut {
  status: 'available' | 'unavailable'
  points: StockPairReturnPointOut[]
  // Descriptive fit: candidate = intercept + slope * target, both in fractions.
  intercept: number | null
  slope: number | null
  reason: string | null
}

export interface StockPairMarketCheckOut {
  status: StockPairMarketCheckStatus
  correlation: number | null
  sample_size: number
  start_date: string | null
  end_date: string | null
  reason: string | null
}

export interface StockPairWindowOut {
  start_date: string
  end_date: string
  sample_size: number
  correlation: number | null
  target_up_days: number
  both_up_days: number
  candidate_up_days: number
  up_day_agreement_pct: number | null
  baseline_up_day_pct: number | null
  up_day_improvement_pp: number | null
  market_check: StockPairMarketCheckOut
  // Absent or null in reports saved before scatter plots existed.
  scatter?: StockPairScatterOut | null
}

export interface StockPairItemOut {
  ticker: string
  company_name: string | null
  // Unsupported Google listings are retained on Not confirmed candidates.
  exchange: string | null
  explanation: string
  strength: StockPairStrength
  evidence_status: StockPairEvidenceStatus
  reasons: string[]
  three_month: StockPairWindowOut | null
  six_month: StockPairWindowOut | null
  // Absent or null in reports saved before sources were independently checked.
  business_evidence?: StockPairBusinessEvidenceOut | null
}

export interface StockPairsOut {
  snapshot_id: number
  ticker: string
  question: string
  answer_markdown: string
  sources: GoogleFinanceResearchSourceOut[]
  source: SourceStatus
  generated_at: string
  verified_at: string
  data_through: string
  method_version: string
  items: StockPairItemOut[]
  warnings: string[]
  cached: boolean
  caveat: string
}

export interface RelatedEtfOut {
  ticker: string
  name: string | null
  weight_pct: number
  holdings_date: string
  source: 'issuer' | 'sec_nport'
  quote: QuoteOut
}

export interface RelatedEtfsOut {
  ticker: string
  status: 'available' | 'empty' | 'unavailable'
  stale: boolean
  fetched_at: string | null
  total_count: number
  items: RelatedEtfOut[]
  attribution_name: string
  attribution_url: string
}

export interface EtfDescriptionOut {
  ticker: string
  description: string | null
  fetched_at: string | null
  stale: boolean
  source_name: string
  source_url: string
}

export type TickerDescriptionOut = EtfDescriptionOut

export type RelatedEtfRelevanceCategory = 'direct' | 'adjacent' | 'sector' | 'broad' | 'unknown'

export interface RelatedEtfRelevanceItemOut {
  business_score?: number | null
  weight_pct?: number
  concentration_score?: number
  ticker: string
  score: number | null
  category: RelatedEtfRelevanceCategory | null
  explanation: string | null
  evidence: string | null
  stale: boolean
}

export interface RelatedEtfRelevanceOut {
  ticker: string
  status: 'pending' | 'ready' | 'partial' | 'unavailable'
  items: RelatedEtfRelevanceItemOut[]
  model: string | null
  rubric_version: string
  fetched_at: string | null
}
