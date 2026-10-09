import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { ResearchMonitoringOut } from '@/types/api'
import { useResearchMonitoring } from './hooks'
import { ResearchHealthPanel } from './research-health-panel'

vi.mock('./hooks', () => ({ useResearchMonitoring: vi.fn() }))

const report: ResearchMonitoringOut = {
  generated_at: '2026-09-26T12:00:00Z',
  current_catalyst_rule_version: 'catalyst-initial-v5',
  horizon_sessions: 1,
  latest_finalized_session: '2026-09-25',
  bar_sessions: [
    {
      session_date: '2026-09-25',
      expected_symbols: 900,
      complete_symbols: 870,
      checkpoint_status: 'partial',
      checkpoint_synced: 860,
      checkpoint_coverage_pct: 860 / 900,
      attempts: 2,
      last_attempt_at: '2026-09-25T23:00:00Z',
    },
    {
      session_date: '2026-09-24',
      expected_symbols: 900,
      complete_symbols: 700,
      checkpoint_status: 'partial',
      checkpoint_synced: 700,
      checkpoint_coverage_pct: 700 / 900,
      attempts: 3,
      last_attempt_at: '2026-09-25T12:00:00Z',
    },
  ],
  baseline_sessions: [
    { baseline_session: '2026-09-25', rule_version: 'catalyst-initial-v3', complete: 40, partial: 2 },
    { baseline_session: '2026-09-22', rule_version: 'catalyst-initial-v2', complete: 164, partial: 535 },
  ],
  catalyst_cohorts: [
    {
      rule_version: 'catalyst-initial-v2', baseline_status: 'partial', candidates: 535,
      daily_measured: 500, reaction_pct_n: 0, mean_reaction_pct: null,
      reaction_atr_n: 0, mean_reaction_atr: null, volume_ratio_n: 0,
      mean_volume_ratio: null, outcomes_recorded: 535, outcomes_matured: 520,
      outcomes_evaluated: 500, outcomes_missing: 20, excess_return_n: 490,
      mean_excess_return_pct: -0.2,
    },
    {
      rule_version: 'catalyst-initial-v3', baseline_status: 'full', candidates: 40,
      daily_measured: 38, reaction_pct_n: 38, mean_reaction_pct: 1.2,
      reaction_atr_n: 38, mean_reaction_atr: 0.7, volume_ratio_n: 38,
      mean_volume_ratio: 1.4, outcomes_recorded: 40, outcomes_matured: 36,
      outcomes_evaluated: 35, outcomes_missing: 1, excess_return_n: 34,
      mean_excess_return_pct: 0.8,
    },
  ],
  usage: {
    follow_through: { total: 1, active: 0, started_30d: 1 },
    subscriptions: { total: 2, enabled: 0, created_30d: 2, ever_succeeded: 1 },
    setup_revisions: {
      total: 0, created_30d: 0, manual_total: 0,
      manual_created_30d: 0, automated_total: 0, manual_edits: 0,
    },
  },
}

function mockReport(data: ResearchMonitoringOut) {
  vi.mocked(useResearchMonitoring).mockReturnValue({
    data, isPending: false, isError: false, refetch: vi.fn(),
  } as never)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('shows coverage, frozen partial baselines, separated cohorts and actual use', () => {
  mockReport(report)
  renderWithProviders(<ResearchHealthPanel />)

  expect(screen.getByRole('row', { name: /2026-09-25.*870.*900/ })).toHaveTextContent('95.6%')
  expect(screen.getByText(/historical sync gap/i)).toBeInTheDocument()
  expect(screen.queryByText(/investigate latest coverage below 95%/i)).not.toBeInTheDocument()
  expect(screen.getByRole('row', { name: /2026-09-22.*catalyst-initial-v2/ })).toHaveTextContent('535')
  expect(screen.getByRole('row', { name: /catalyst-initial-v2.*partial/i })).toHaveTextContent('490')
  const fullV3 = screen.getByRole('row', { name: /catalyst-initial-v3.*full/i })
  expect(fullV3).toHaveTextContent('+1.20% (38)')
  expect(fullV3).toHaveTextContent('40 / 36 / 35 / 1')
  expect(fullV3).toHaveTextContent('+0.80%')
  expect(screen.getByText(/0 manual setup revisions/i)).toBeInTheDocument()
  expect(screen.getByText(/headline relevance still needs manual review/i)).toBeInTheDocument()
})

test('missing checkpoint stays unknown and horizon change queries a new cohort', () => {
  mockReport({ ...report, bar_sessions: [{
    ...report.bar_sessions[0], expected_symbols: null,
    checkpoint_status: null, checkpoint_synced: null,
    checkpoint_coverage_pct: null,
    attempts: null, last_attempt_at: null,
  }] })
  renderWithProviders(<ResearchHealthPanel />)

  expect(screen.getByRole('row', { name: /2026-09-25.*870/ })).toHaveTextContent('Unknown')
  fireEvent.mouseDown(screen.getByRole('tab', { name: '3 sessions' }))
  expect(useResearchMonitoring).toHaveBeenLastCalledWith(3)
})

test('says when current-rule evidence has not entered the monitored window', () => {
  mockReport({
    ...report,
  })
  renderWithProviders(<ResearchHealthPanel />)

  expect(screen.getByText(/no catalyst-initial-v5 candidates in this lookback/i)).toBeInTheDocument()
})

test('warns about a renewed drop on the latest finalized session', () => {
  mockReport({
    ...report,
    bar_sessions: [{
      ...report.bar_sessions[0],
      checkpoint_synced: 700,
      checkpoint_coverage_pct: 700 / 900,
    }, report.bar_sessions[1]],
  })
  renderWithProviders(<ResearchHealthPanel />)
  expect(screen.getByText(/investigate latest coverage below 95%/i)).toBeInTheDocument()
})

test('shows scanner collection and an incomplete warm-up beside the other producers', () => {
  mockReport({
    ...report,
    short_squeeze: {
      collection_enabled: false,
      latest_publication_id: 4,
      latest_target_session: '2026-09-25',
      latest_published_at: '2026-09-25T20:46:00Z',
      latest_confirmed_at: '2026-09-25T21:46:00Z',
      coverage: { evaluated: 900, matched: 3, incomplete: 12, excluded: 885, missing_reason_counts: {} },
      corrections: 1,
      observations_recorded: 9,
      checkpoint_target_session: '2026-09-25',
      checkpoints: { complete: 5, failed: 2, pending: 1 },
    },
  })
  renderWithProviders(<ResearchHealthPanel />)

  const card = screen.getByRole('region', { name: 'Short Squeeze scanner' })
  expect(card).toHaveTextContent('Collection off')
  expect(card).toHaveTextContent('Warm-up incomplete: 2 failed, 1 pending')
  expect(card).toHaveTextContent('900 evaluated / 3 matched / 12 incomplete')
  expect(card).toHaveTextContent('1 corrected')
  // The other producers stay visible.
  expect(screen.getByText('Daily bars by finalized session')).toBeInTheDocument()
})

test('a complete warm-up and an older backend are both handled', () => {
  mockReport({
    ...report,
    short_squeeze: {
      collection_enabled: true,
      latest_publication_id: null,
      latest_target_session: null,
      latest_published_at: null,
      latest_confirmed_at: null,
      coverage: null,
      corrections: 0,
      observations_recorded: 0,
      checkpoint_target_session: '2026-09-25',
      checkpoints: { complete: 4 },
    },
  })
  const { unmount } = renderWithProviders(<ResearchHealthPanel />)
  const card = screen.getByRole('region', { name: 'Short Squeeze scanner' })
  expect(card).toHaveTextContent('Collecting')
  expect(card).toHaveTextContent('No scan published yet')
  expect(card).not.toHaveTextContent('Warm-up incomplete')
  unmount()

  mockReport(report)
  renderWithProviders(<ResearchHealthPanel />)
  expect(screen.queryByRole('region', { name: 'Short Squeeze scanner' })).not.toBeInTheDocument()
})
