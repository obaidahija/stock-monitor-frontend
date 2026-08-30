import type { UniverseTickerOut } from '@/types/api'

/** Fills every required UniverseTickerOut field with a neutral default so a
 * test only has to state the fields it actually asserts on. If `tsc -b`
 * complains here, correct this against src/types/api.ts -- that interface is
 * the source of truth, not this fixture. */
export function universeRow(overrides: Partial<UniverseTickerOut>): UniverseTickerOut {
  return {
    ticker: 'TEST',
    company_name: null,
    is_manual: false,
    note: null,
    added_at: '2026-08-30T00:00:00Z',
    score: 50,
    lean: 'neutral',
    score_updated_at: '2026-08-30T00:00:00Z',
    sector: null,
    industry: null,
    market_cap: null,
    avg_volume_20d: null,
    pct_from_12wk_avg: null,
    next_earnings_date: null,
    next_earnings_bmo_amc: null,
    last_earnings_result: null,
    last_earnings_surprise_pct: null,
    is_reit: false,
    price: null,
    change_pct: null,
    volume: null,
    volume_ratio: null,
    pe_ratio: null,
    catalyst: null,
    quote_updated_at: null,
    recent_pattern: null,
    score_change_1d: null,
    score_change_5d: null,
    insider_cluster_buy: false,
    insider_buy_value_usd: null,
    short_percent_of_float: null,
    float_shares: null,
    sector_score_percentile: null,
    industry_score_percentile: null,
    ...overrides,
  } as UniverseTickerOut
}
