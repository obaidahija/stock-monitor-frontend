import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { MacroSectorImpactBucketOut, MacroSectorImpactOut } from '@/types/api'
import { MacroAttentionStrip } from './macro-attention-strip'

function bucket(
  overrides: Partial<MacroSectorImpactBucketOut> & Pick<MacroSectorImpactBucketOut, 'net'>,
): MacroSectorImpactBucketOut {
  return { positive_count: 0, negative_count: 0, items: [], ...overrides }
}

const item = (direction: 'positive' | 'negative' | 'insulated', rationale: string) => ({
  id: 1,
  title: 'Oil spikes on supply shock',
  url: 'https://example.com/oil',
  category: 'oil_energy',
  via_category: null,
  direction,
  rationale,
  stance: 'hawkish',
  magnitude: 'notable',
  direction_note: '',
})

const snapshot: MacroSectorImpactOut = {
  impact_date: '2026-10-09',
  window_hours: 24,
  items_considered: 1,
  items_resolved: 1,
  generated_at: '2026-10-09T12:00:00Z',
  sectors: {
    Energy: bucket({ net: 'positive', positive_count: 2, items: [item('positive', 'sector')] }),
  },
  industries: {
    // Same direction as the sector: not shown.
    'Oil & Gas E&P': bucket({ net: 'positive', positive_count: 2, sector: 'Energy', items: [item('positive', 'refine')] }),
    // Inverted.
    'Oil & Gas Refining & Marketing': bucket({
      net: 'negative',
      negative_count: 2,
      sector: 'Energy',
      items: [item('negative', 'Crude is the refiner input')],
    }),
    // Insulated.
    Uranium: bucket({ net: 'insulated', sector: 'Energy', items: [item('insulated', 'Nuclear fuel is contracted')] }),
    // Sector has no read at all.
    Solar: bucket({ net: 'positive', positive_count: 1, sector: 'Technology', items: [item('positive', 'alt energy')] }),
  },
}

vi.mock('@/features/macro/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/macro/hooks')>()),
  useMacroSectorImpact: () => ({ data: snapshot }),
}))

afterEach(cleanup)

test('shows only industries whose read diverges from their sector', () => {
  renderWithProviders(<MacroAttentionStrip />)

  expect(screen.getByTestId('diverging-industry-Oil & Gas Refining & Marketing')).toHaveTextContent('−2')
  expect(screen.getByTestId('diverging-industry-Uranium')).toHaveTextContent('Uranium')
  expect(screen.getByTestId('diverging-industry-Solar')).toHaveTextContent('Technology')
  expect(screen.queryByTestId('diverging-industry-Oil & Gas E&P')).not.toBeInTheDocument()
})

test('clicking a diverging industry filters by sector and industry', async () => {
  renderWithProviders(<MacroAttentionStrip />)

  const pill = screen.getByTestId('diverging-industry-Uranium')
  expect(pill).toHaveAttribute('aria-pressed', 'false')

  // The strip reads the active sector/industry back from the URL params it
  // set (MemoryRouter, so assert through the pressed state, not location).
  await userEvent.click(pill)
  expect(screen.getByTestId('diverging-industry-Uranium')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('diverging-industry-Solar')).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByTestId('diverging-industry-Uranium'))
  expect(screen.getByTestId('diverging-industry-Uranium')).toHaveAttribute('aria-pressed', 'false')
})
