import { cleanup, render, screen, within } from '@testing-library/react'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import type { PairStrategyOut, PairStrategyPointOut } from '@/types/pair-strategy'
import { PairSpreadChart, SpreadTooltipContent } from './pair-spread-chart'
import { spreadAxis } from './pair-spread-geometry'
import {
  insufficientStrategy,
  notSupportedStrategy,
  observationDates,
  strategyPoint,
  strategyPoints,
  strategyWith,
  supportedStrategy,
} from './test-fixtures'

// jsdom has no layout, so the responsive wrapper would measure 0×0 and draw
// nothing; give the chart a fixed size and keep everything else real.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, {
            width: 560,
            height: 320,
          })
        : null,
  }
})

afterEach(cleanup)

function withPoints(points: PairStrategyPointOut[], report: PairStrategyOut = supportedStrategy) {
  const final = points[points.length - 1]
  return strategyWith(
    {
      ...report.calculation,
      points,
      spread: final.spread,
      spread_mean: final.mean,
      spread_std: final.std,
      z_score: final.z_score,
    },
    report,
  )
}

function curve(container: HTMLElement, series: 'spread' | 'mean' | 'upper' | 'lower') {
  return container.querySelector<SVGPathElement>(
    `path.recharts-line-curve[stroke="var(--color-${series})"]`,
  )
}

function segments(path: SVGPathElement | null) {
  return (path?.getAttribute('d')?.match(/M/g) ?? []).length
}

test('each saved observation is one dated point on the spread line, with three reference lines', () => {
  const { container } = render(<PairSpreadChart report={supportedStrategy} />)

  const figure = screen.getByRole('figure', { name: 'Adjusted-price spread of WDC against STX' })
  expect(figure).toBeInTheDocument()
  expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(21)
  for (const series of ['spread', 'mean', 'upper', 'lower'] as const) {
    expect(curve(container, series)).not.toBeNull()
  }
  expect(screen.getByText('Adjusted-price spread')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
})

test('the caption names both stocks, the fixed fit and both periods', () => {
  render(<PairSpreadChart report={supportedStrategy} />)

  expect(screen.getByText('Spread = WDC − (7.12 + 1.493 × STX)')).toBeInTheDocument()
  expect(screen.getByText(/^Hedge ratio fitted on the formation period/)).toHaveTextContent(
    'Aug 28, 2025 – Aug 31, 2026',
  )
  expect(screen.getByText(/^Plotted/)).toHaveTextContent(
    'Sep 1, 2026 – Sep 30, 2026, the 21-session observation period',
  )
  expect(screen.getByText(/previous 20 sessions/)).toBeInTheDocument()
  expect(screen.getByRole('figure')).not.toHaveTextContent(/profit|return on|gain/i)
})

test('the table lists every observation with its spread, baseline, bands and z-score', () => {
  render(<PairSpreadChart report={supportedStrategy} />)

  const region = screen.getByRole('region', { name: 'Daily spread values' })
  expect(region).toHaveAttribute('tabindex', '0')
  const table = within(region).getByRole('table', { name: 'Daily spread of WDC against STX' })
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(22)
  expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Date',
    'Spread',
    'Mean (previous 20)',
    'Lower band',
    'Upper band',
    'z-score',
  ])
  // strategyPoint(0, -0.8): z = (-0.8 - 0.1) / 0.6 = -1.5; bands 0.1 ± 1.2.
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Sep 1, 2026',
    '-0.80',
    '0.10',
    '-1.10',
    '1.30',
    '-1.50',
  ])
  expect(within(rows[21]).getAllByRole('cell')[0]).toHaveTextContent('Sep 30, 2026')
})

test('a missing baseline is a gap in its lines and a dash in the table, never a zero', () => {
  const points = strategyPoints(-0.8)
  points[10] = { ...points[10], mean: null, std: null, lower_band: null, upper_band: null, z_score: null }
  const { container } = render(<PairSpreadChart report={withPoints(points)} />)

  expect(segments(curve(container, 'mean'))).toBe(2)
  expect(segments(curve(container, 'upper'))).toBe(2)
  expect(segments(curve(container, 'lower'))).toBe(2)
  expect(segments(curve(container, 'spread'))).toBe(1)
  const rows = within(screen.getByRole('table', { name: /Daily spread/ })).getAllByRole('row')
  // strategyPoints puts ((10 % 5) - 2) * 0.4 = -0.8 on 2026-09-16, the eleventh session.
  expect(within(rows[11]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Sep 16, 2026',
    '-0.80',
    '—',
    '—',
    '—',
    '—',
  ])
})

test('negative spreads stay inside the vertical axis', () => {
  const points = strategyPoints(-6.4)
  points[3] = strategyPoint(3, -9.25)
  const { container } = render(<PairSpreadChart report={withPoints(points)} />)

  const axis = spreadAxis(points)
  expect(axis.domain[0]).toBeLessThanOrEqual(-9.25)
  expect(axis.domain[1]).toBeGreaterThanOrEqual(1.3)
  const ticks = Array.from(
    container.querySelectorAll('.recharts-yAxis-tick-labels text'),
    (tick) => Number(tick.textContent),
  )
  expect(Math.min(...ticks)).toBeLessThanOrEqual(-9.25)
})

test('narrow spreads retain their signed values and distinct axis labels', () => {
  const points = strategyPoints(-1.5).map((point) => ({
    ...point,
    spread: point.spread * 0.001,
    mean: 0.0001,
    std: 0.0006,
    lower_band: -0.0011,
    upper_band: 0.0013,
  }))
  const { container } = render(<PairSpreadChart report={withPoints(points)} />)

  const rows = within(screen.getByRole('table', { name: /Daily spread/ })).getAllByRole('row')
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Sep 1, 2026', '-0.0008', '0.0001', '-0.0011', '0.0013', '-1.50',
  ])
  const ticks = Array.from(
    container.querySelectorAll('.recharts-yAxis-tick-labels text'),
    (tick) => tick.textContent,
  )
  expect(ticks.length).toBeGreaterThan(1)
  expect(new Set(ticks).size).toBe(ticks.length)
  expect(ticks.some((text) => Number(text) < 0)).toBe(true)
  expect(ticks.some((text) => Number(text) > 0)).toBe(true)
})

test('a narrow-spread tooltip preserves values smaller than one cent', () => {
  render(
    <SpreadTooltipContent
      active
      entryZ={2}
      payload={[{
        payload: {
          date: '2026-09-15', spread: -0.0023, mean: 0.0001,
          lower: -0.0011, upper: 0.0013, z: -4,
        },
      }]}
    />,
  )

  expect(screen.getByText('Spread: -0.0023')).toBeInTheDocument()
  expect(screen.getByText('Mean: 0.0001')).toBeInTheDocument()
  expect(screen.getByText('Bands: -0.0011 to 0.0013')).toBeInTheDocument()
  expect(screen.getByText('z-score: -4.00')).toBeInTheDocument()
})

test('axis labels preserve quarter-cent tick steps across one cent', () => {
  const points = observationDates.map((date, index) => ({
    date,
    spread: index % 2 === 0 ? 0.011 : 0.009,
    mean: 0.01,
    std: 0.001,
    lower_band: 0.008,
    upper_band: 0.012,
    z_score: index % 2 === 0 ? 1 : -1,
  }))
  const { container } = render(<PairSpreadChart report={withPoints(points)} />)
  const ticks = Array.from(
    container.querySelectorAll('.recharts-yAxis-tick-labels text'),
    (tick) => tick.textContent,
  )

  expect(ticks).toContain('0.0125')
  expect(new Set(ticks).size).toBe(ticks.length)
})

test('a tiny nonzero spread stays visible within an ordinary chart range', () => {
  const points = strategyPoints(-0.8)
  points[0] = { ...points[0], spread: -8e-9, z_score: (-8e-9 - 0.1) / 0.6 }
  render(<PairSpreadChart report={withPoints(points)} />)
  const rows = within(screen.getByRole('table', { name: /Daily spread/ })).getAllByRole('row')

  expect(Number(within(rows[1]).getAllByRole('cell')[1].textContent)).toBe(-8e-9)
})

test('a spread that never moves still gets a readable axis', () => {
  const flat = observationDates.map((date) => ({
    date,
    spread: 2.5,
    mean: 2.5,
    std: null,
    lower_band: null,
    upper_band: null,
    z_score: null,
  }))

  const axis = spreadAxis(flat)

  expect(axis.domain[1] - axis.domain[0]).toBeGreaterThan(0)
  expect(axis.domain[0]).toBeLessThanOrEqual(2.5)
  expect(axis.domain[1]).toBeGreaterThanOrEqual(2.5)
})

test('insufficient history is explained instead of drawing an empty chart', () => {
  const { container } = render(<PairSpreadChart report={insufficientStrategy} />)

  expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  expect(container.querySelector('svg.recharts-surface')).toBeNull()
  expect(screen.getByText(/^No spread chart/)).toHaveTextContent('not enough shared history')
})

test('an unsupported relationship keeps its descriptive points and its label', () => {
  const { container } = render(<PairSpreadChart report={notSupportedStrategy} />)

  const figure = screen.getByRole('figure')
  expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(21)
  expect(within(figure).getByText(/^Relationship not supported/)).toHaveTextContent(
    'descriptive only',
  )
})

test('the tooltip dates the observation and shows missing values as dashes', () => {
  render(
    <SpreadTooltipContent
      active
      entryZ={2}
      payload={[
        {
          payload: {
            date: '2026-09-15',
            spread: -1.234,
            mean: null,
            lower: null,
            upper: null,
            z: null,
          },
        },
      ]}
    />,
  )

  expect(screen.getByText('Sep 15, 2026')).toBeInTheDocument()
  expect(screen.getByText('Spread: -1.23')).toBeInTheDocument()
  expect(screen.getByText('Mean: —')).toBeInTheDocument()
  expect(screen.getByText('Bands: —')).toBeInTheDocument()
  expect(screen.getByText('z-score: —')).toBeInTheDocument()
})
