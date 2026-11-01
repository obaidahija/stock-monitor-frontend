import type { FinancialHistoryOut, FinancialMetric, FinancialSource } from '@/types/sec-fundamentals'

export const source: FinancialSource = {
  fact_id: 'revenue-2026q2', concept: 'us-gaap:Revenues', accession: '0000123-26-000001',
  form: '10-Q', filed: '2026-08-05', accepted_at: '2026-08-05T16:00:00Z',
  available_at: '2026-08-05T16:00:00Z', availability_precision: 'acceptance',
  source_url: 'https://www.sec.gov/Archives/edgar/data/123/filing.htm',
}
export function metric(value: string | null, extra: Partial<FinancialMetric> = {}): FinancialMetric {
  return { value, unit: 'USD', method: 'reported', comparability: 'same_filing', reasons: [], sources: [source], ...extra }
}
export function history(extra: Partial<FinancialHistoryOut> = {}): FinancialHistoryOut {
  return {
    ticker: 'NVDA', cik: '0000000123', snapshot_id: 7, publication_id: 9,
    normalizer_version: 'v1', currency: 'USD', period: 'quarterly',
    periods: [{ period_start: '2026-04-01', period_end: '2026-06-30', fiscal_label: 'FY2026 Q2',
      period_type: 'quarterly', metrics: { revenue: metric('9007199254740993.12'), net_income: metric('0'),
        operating_cash_flow: metric(null, { reasons: ['missing_concept'], sources: [] }),
        free_cash_flow: metric('-125.25', { method: 'derived', comparability: 'mixed_filings', reasons: ['later_disclosure'] }),
        operating_margin: metric('12.3456', { unit: 'percent', method: 'derived' }) } }],
    quality: { status: 'partial', reasons: ['missing_concept'] },
    coverage: { annual_periods: 3, quarterly_periods: 8, metrics_available: 4, metrics_expected: 5 },
    latest_period_end: '2026-06-30', latest_filing_date: '2026-08-05',
    checked_at: '2026-10-28T12:00:00Z', observed_at: '2026-10-27T12:00:00Z', published_at: '2026-10-27T12:01:00Z',
    pending_filings: [], collection_enabled: true,
    refresh: { request_id: null, state: 'idle', error: null, snapshot_id: null }, ...extra,
  }
}
