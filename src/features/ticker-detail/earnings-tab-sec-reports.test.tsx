import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { getEarningsReports, refreshEarningsReports } from '@/api/stocks'
import { renderWithProviders } from '@/test/render'
import type { EarningsReportsOut } from '@/types/api'
import { EarningsTab } from './earnings-tab'
import { useEarnings } from './hooks'

vi.mock('@/api/stocks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/stocks')>(),
  getEarningsReports: vi.fn(),
  refreshEarningsReports: vi.fn(),
}))
vi.mock('./hooks', () => ({
  useEarnings: vi.fn(),
  useEarningsReaction: () => ({ isPending: false, data: undefined }),
  useRefreshEarnings: () => ({ isPending: false, mutate: vi.fn() }),
  useCatalysts: () => ({ data: [] }),
}))
vi.mock('./eps-trend-chart', () => ({ EpsTrendChart: () => null }))
vi.mock('./earnings-reaction-chart', () => ({ EarningsReactionChart: () => null }))
vi.mock('./earnings-playbook-card', () => ({ EarningsPlaybookCard: () => null }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const saved: EarningsReportsOut = {
  ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [{
    filing_id: 7, accession_number: '0000000001-26-000001', form_type: '8-K',
    available_at: '2026-11-10T21:05:00Z',
    filing_url: 'https://www.sec.gov/Archives/edgar/data/1/123/release.htm',
    guidance_status: 'not_identified',
    analysis: {
      status: 'completed', findings: [{
        topic: 'performance', fact: 'Saved SEC operating results.',
        why_it_matters: 'Reported results provide business context.', direction: 'neutral',
        importance: 'medium', evidence_quality: 'direct', change: 'not_compared',
        prior_evidence: null, numbers: [], evidence: {
          source_id: 'c0', content_hash: 'a'.repeat(64), section: 'Results',
          excerpt: 'Saved SEC operating results.',
          source_url: 'https://www.sec.gov/Archives/edgar/data/1/123/release.htm',
        },
      }],
    },
  }],
}

test.each(['loading', 'error'] as const)(
  'saved SEC reports remain readable and refreshable while provider history is %s',
  async (state) => {
    vi.mocked(useEarnings).mockReturnValue({
      data: undefined, isPending: state === 'loading', isError: state === 'error',
      error: state === 'error' ? new Error('Provider unavailable') : null, refetch: vi.fn(),
    } as never)
    vi.mocked(getEarningsReports).mockResolvedValue(saved)
    vi.mocked(refreshEarningsReports).mockResolvedValue({
      ticker: 'NVDA', queued: 0, filing_ids: [], error: null,
    })

    renderWithProviders(<EarningsTab ticker="NVDA" />)
    expect(await screen.findByText('Saved SEC operating results.')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh SEC reports' }))
    await waitFor(() => expect(refreshEarningsReports).toHaveBeenCalledWith('NVDA'))
  },
)
