import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { MacroIndustryReadOut, MacroMovingOut } from '@/types/api'
import { MacroAttentionStrip } from './macro-attention-strip'

const push = (move: number) => ({
  driver: 'oil',
  direction: 'up' as const,
  effect: move > 0 ? ('positive' as const) : ('negative' as const),
  typical_move_pp: move,
  consistency: 1,
})

const industry = (name: string, sector: string, move: number): MacroIndustryReadOut => ({
  industry: name,
  sector,
  members: 6,
  net: move > 0 ? 'positive' : 'negative',
  typical_move_pp: move,
  pushes: [push(move)],
})

let moving: MacroMovingOut

function base(overrides: Partial<MacroMovingOut> = {}): MacroMovingOut {
  return {
    window_hours: 24,
    items: 70,
    items_read: 70,
    relevant_items: 9,
    events: [],
    drivers: [{ driver: 'oil_price', direction: 'up', events: 3, magnitude: 'notable', headlines: [] }],
    sectors: [
      { sector: 'Energy', net: 'positive', typical_move_pp: 1.17, pushes: [push(0.82)] },
      { sector: 'Industrials', net: 'negative', typical_move_pp: -0.13, pushes: [push(-0.13)] },
    ],
    industries: [
      industry('Oil & Gas E&P', 'Energy', 1.69),
      industry('Airlines', 'Industrials', -1.58),
      industry('Waste Management', 'Industrials', 0.39),
    ],
    sector_basis: 'measured',
    caveat: '',
    generated_at: '2026-11-27T12:00:00Z',
    ...overrides,
  }
}

vi.mock('@/features/macro/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/macro/hooks')>()),
  useMacroMoving: () => ({ data: moving }),
}))

afterEach(cleanup)

test('shows measured sector moves, strongest first, and today\'s drivers', () => {
  moving = base()
  renderWithProviders(<MacroAttentionStrip />)

  const sectors = screen.getByRole('group', { name: 'Sectors with a notable macro read today' })
  expect(sectors.textContent).toMatch(/Energy\+1\.17.*Industrials−0\.13/)
  expect(screen.getByRole('img', { name: 'Predominantly bullish macro pressure today' })).toBeInTheDocument()
  expect(screen.getByText('Oil')).toBeInTheDocument()
})

test('lists the most affected industries and flags one moving against its sector', () => {
  moving = base()
  renderWithProviders(<MacroAttentionStrip />)

  expect(screen.getByTestId('macro-industry-Airlines')).toHaveTextContent('−1.58')
  expect(screen.getByTestId('macro-industry-Airlines')).not.toHaveTextContent('vs sector')
  expect(screen.getByTestId('macro-industry-Waste Management')).toHaveTextContent('vs sector')
})

test('clicking an industry filters by its sector and industry', async () => {
  moving = base()
  renderWithProviders(<MacroAttentionStrip />)

  const pill = screen.getByTestId('macro-industry-Airlines')
  expect(pill).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(pill)
  expect(screen.getByTestId('macro-industry-Airlines')).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByTestId('macro-industry-Airlines'))
  expect(screen.getByTestId('macro-industry-Airlines')).toHaveAttribute('aria-pressed', 'false')
})

test('renders nothing before measured exposures exist', () => {
  moving = base({ sector_basis: 'learned_rules' })
  const { container } = renderWithProviders(<MacroAttentionStrip />)
  expect(container).toBeEmptyDOMElement()
})
