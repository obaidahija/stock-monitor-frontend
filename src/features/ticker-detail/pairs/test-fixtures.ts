import type { StockPairItemOut, StockPairsOut, StockPairWindowOut } from '@/types/api'

export const sixMonth: StockPairWindowOut = {
  start_date: '2026-04-08',
  end_date: '2026-09-30',
  sample_size: 120,
  correlation: 0.8213,
  target_up_days: 70,
  both_up_days: 56,
  candidate_up_days: 66,
  up_day_agreement_pct: 80,
  baseline_up_day_pct: 55,
  up_day_improvement_pp: 25,
  market_check: {
    status: 'available',
    correlation: 0.1234,
    sample_size: 118,
    start_date: '2026-04-08',
    end_date: '2026-09-30',
    reason: null,
  },
}

export const threeMonth: StockPairWindowOut = {
  start_date: '2026-07-02',
  end_date: '2026-09-30',
  sample_size: 63,
  correlation: 0.6512,
  target_up_days: 35,
  both_up_days: 25,
  candidate_up_days: 33,
  up_day_agreement_pct: 71.4286,
  baseline_up_day_pct: 52.381,
  up_day_improvement_pp: 19.0476,
  market_check: {
    status: 'unavailable',
    correlation: null,
    sample_size: 30,
    start_date: '2026-08-12',
    end_date: '2026-09-30',
    reason: 'Only 30 aligned SPY returns (minimum 40).',
  },
}

export const seagate: StockPairItemOut = {
  ticker: 'STX',
  company_name: 'Seagate Technology Holdings plc',
  exchange: 'NASDAQ',
  explanation: 'Duopoly in enterprise hard drives',
  strength: 'moderate',
  evidence_status: 'computed',
  reasons: [],
  three_month: threeMonth,
  six_month: sixMonth,
}

export const newListing: StockPairItemOut = {
  ticker: 'NEWC',
  company_name: 'New Storage Co',
  exchange: 'NYSE',
  explanation: 'Recently listed storage supplier',
  strength: 'not_confirmed',
  evidence_status: 'insufficient_data',
  reasons: ['3 months: only 33 aligned daily returns (minimum 40).'],
  three_month: {
    ...threeMonth,
    sample_size: 33,
    correlation: null,
    up_day_agreement_pct: null,
    up_day_improvement_pp: null,
  },
  six_month: null,
}

export const fund: StockPairItemOut = {
  ticker: 'QQQ',
  company_name: 'Invesco QQQ Trust',
  exchange: 'NASDAQ',
  explanation: 'Tracks large technology stocks',
  strength: 'not_confirmed',
  evidence_status: 'invalid_security',
  reasons: ['QQQ is listed as ETF, not a common stock.'],
  three_month: null,
  six_month: null,
}

export const savedReport: StockPairsOut = {
  snapshot_id: 7,
  ticker: 'WDC',
  question: 'As of 2026-10-01 (UTC), list up to 5 current US-listed common stocks…',
  answer_markdown: 'Seagate (**STX**) shares the hard-drive cycle with Western Digital.',
  sources: [
    {
      title: 'Storage stocks move together',
      publisher: 'Example News',
      url: 'https://example.com/storage-peers',
    },
  ],
  source: {
    name: 'google_finance',
    ok: true,
    fetched_at: '2026-10-01T12:01:30Z',
    error: null,
    latency_ms: 4200,
  },
  generated_at: '2026-10-01T12:01:30Z',
  verified_at: '2026-10-01T12:02:05Z',
  data_through: '2026-09-30',
  method_version: 'stock-pairs-v1',
  items: [seagate, newListing, fund],
  warnings: [],
  cached: true,
  caveat: 'Historical co-movement; this does not predict future prices.',
}
