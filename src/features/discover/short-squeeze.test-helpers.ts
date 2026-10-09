import type {
  ShortSqueezeConditionOut,
  ShortSqueezeConditionsOut,
  ShortSqueezeDetailOut,
  ShortSqueezeItemOut,
  ShortSqueezeListOut,
} from '@/types/short-squeeze'

export function condition(overrides: Partial<ShortSqueezeConditionOut> = {}): ShortSqueezeConditionOut {
  return { state: 'pass', value: null, threshold: null, comparison: '>', reason: null, ...overrides }
}

export function conditions(overrides: Partial<ShortSqueezeConditionsOut> = {}): ShortSqueezeConditionsOut {
  return {
    short_float: condition({ value: 12, threshold: 7 }),
    days_to_cover: condition({ value: 6, threshold: 5 }),
    daily_gain: condition({ value: 8, threshold: 7 }),
    high_close: condition({ state: 'fail', value: 10.8, threshold: 12, comparison: '>=' }),
    price_strength: condition({ comparison: 'any' }),
    ...overrides,
  }
}

export function squeezeItem(overrides: Partial<ShortSqueezeItemOut> = {}): ShortSqueezeItemOut {
  return {
    evaluation_id: 1,
    ticker: 'SQZ',
    company_name: 'Squeeze Corp',
    status: 'matched',
    signal_session: '2026-10-05',
    signal_close: 10.8,
    move_pct: 8,
    prior_high: 12,
    high_touched: false,
    close_gap_to_high_pct: -10,
    relative_volume: 2.5,
    short_percent_of_float: 12,
    short_ratio: 6,
    float_shares: 50_000_000,
    short_metadata_fetched_at: '2026-10-05T08:45:00Z',
    short_report_date: '2026-09-15',
    conditions: conditions(),
    quality_reasons: [],
    observation_id: 7,
    first_matched_at: '2026-10-05T20:46:00Z',
    source_corrected: false,
    ...overrides,
  }
}

export function squeezeList(overrides: Partial<ShortSqueezeListOut> = {}): ShortSqueezeListOut {
  const items = overrides.items ?? [squeezeItem()]
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 10,
    publication_id: 3,
    generated_at: '2026-10-05T20:45:00Z',
    published_at: '2026-10-05T20:46:00Z',
    signal_session: '2026-10-05',
    expected_signal_session: '2026-10-05',
    stale: false,
    data_status: 'current',
    stale_reasons: [],
    collection_enabled: true,
    rule_version: 'short-squeeze-daily-v1',
    coverage: {
      evaluated: 900,
      matched: items.filter((item) => item.status === 'matched').length,
      incomplete: 18,
      excluded: 900 - 18 - items.filter((item) => item.status === 'matched').length,
      missing_reason_counts: { high_history_incomplete: 18 },
    },
    sources: [],
    ...overrides,
  }
}

export function squeezeDetail(overrides: Partial<ShortSqueezeDetailOut> = {}): ShortSqueezeDetailOut {
  return {
    ...squeezeItem(),
    publication_id: 3,
    published_at: '2026-10-05T20:46:00Z',
    rule_version: 'short-squeeze-daily-v1',
    constants: { short_float_threshold_pct: 7, days_to_cover_threshold: 5, daily_gain_threshold_pct: 7, high_lookback_sessions: 252 },
    evidence: { short: { snapshot_id: 9, report_date: '2026-09-15' } },
    metrics: { signal_close: 10.8, prior_high: 12, close_gap_to_high_pct: -10 },
    first_match: {
      observation_id: 7,
      decision_at: '2026-10-05T20:46:00Z',
      available_at: '2026-10-05T20:45:00Z',
      signal_session: '2026-10-05',
      baseline_session: '2026-10-06',
      rule_version: 'short-squeeze-daily-v1',
      signal_close: 10.8,
      conditions: conditions(),
      metrics: {},
    },
    outcomes: [
      {
        id: 1,
        horizon_sessions: 1,
        measurement_version: 'future-close-v1',
        revision: 1,
        status: 'evaluated',
        status_reason: null,
        baseline_session: '2026-10-06',
        exit_session: '2026-10-07',
        expected_baseline_at: '2026-10-06T20:00:00Z',
        expected_exit_at: '2026-10-07T20:00:00Z',
        baseline_price: 11,
        exit_price: 11.55,
        raw_return_pct: 5,
        side_return_pct: 5,
        cost_adjusted_return_pct: 4.8,
        benchmark_return_pct: 1,
        excess_return_pct: 4,
        adverse_move_pct: 0,
        favorable_move_pct: 7.1,
        path_status: 'complete',
        target_stop_order: null,
        extends_beyond_setup_expiry: null,
        evaluated_at: '2026-10-07T20:31:00Z',
      },
    ],
    ...overrides,
  }
}
