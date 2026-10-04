import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockPairItemOut, StockPairScatterOut } from '@/types/api'
import { PairScatterPlot, ScatterTooltipContent } from './pair-scatter-plot'
import { fittedLine, niceAxis, paddedDomain } from './pair-scatter-geometry'
import { seagate, sixMonth, threeMonth } from './test-fixtures'

// jsdom has no layout, so the responsive wrapper would measure 0×0 and draw
// nothing; give the chart a fixed size and keep everything else real.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, {
            width: 480,
            height: 320,
          })
        : null,
  }
})

afterEach(cleanup)

const FIVE_POINTS: StockPairScatterOut = {
  status: 'available',
  points: [
    { date: '2026-09-24', target_return: 0.01, candidate_return: 0.021 },
    { date: '2026-09-25', target_return: -0.005, candidate_return: -0.009 },
    { date: '2026-09-28', target_return: 0, candidate_return: 0 },
    { date: '2026-09-29', target_return: 0.12, candidate_return: 0.25 },
    { date: '2026-09-30', target_return: -0.02, candidate_return: -0.039 },
  ],
  intercept: 0.001,
  slope: 2,
  reason: null,
}

function plotted(
  scatter: StockPairScatterOut | null | undefined,
  overrides: Partial<NonNullable<StockPairItemOut['six_month']>> = {},
): StockPairItemOut {
  return {
    ...seagate,
    six_month: {
      ...sixMonth,
      start_date: '2026-09-24',
      end_date: '2026-09-30',
      sample_size: scatter?.points.length || 120,
      ...overrides,
      scatter,
    },
  }
}

function symbols(container: HTMLElement) {
  return container.querySelectorAll('.recharts-scatter-symbol').length
}

test('every observation is one dot, on axes named for each stock', () => {
  const { container } = render(
    <PairScatterPlot targetTicker="WDC" item={plotted(FIVE_POINTS)} window="six_month" />,
  )

  expect(symbols(container)).toBe(5)
  expect(screen.getByText('WDC daily return (%)')).toBeInTheDocument()
  expect(screen.getByText('STX daily return (%)')).toBeInTheDocument()
  expect(
    screen.getByRole('figure', { name: '6-month daily returns of STX against WDC' }),
  ).toBeInTheDocument()
  // The summary repeats what the picture shows.
  expect(screen.getByText(/5 daily returns, Sep 24, 2026 – Sep 30, 2026/)).toBeInTheDocument()
  expect(screen.getByText(/correlation 0\.82/)).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
})

test('the table lists every dated observation as percentages', async () => {
  const user = userEvent.setup()
  render(<PairScatterPlot targetTicker="WDC" item={plotted(FIVE_POINTS)} window="six_month" />)

  await user.click(screen.getByText('Show the 5 daily returns as a table'))

  const table = screen.getByRole('table', { name: 'Daily returns of WDC and STX' })
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(6)
  expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Date',
    'WDC',
    'STX',
  ])
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Sep 24, 2026',
    '1.00%',
    '2.10%',
  ])
  expect(within(rows[2]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Sep 25, 2026',
    '-0.50%',
    '-0.90%',
  ])
  // Outliers and flat days are listed like any other observation.
  expect(within(rows[3]).getAllByRole('cell')[1]).toHaveTextContent('0.00%')
  expect(within(rows[4]).getAllByRole('cell')[2]).toHaveTextContent('25.00%')
})

test('the fitted line is described in percentage units and drawn dashed', () => {
  const { container } = render(
    <PairScatterPlot targetTicker="WDC" item={plotted(FIVE_POINTS)} window="six_month" />,
  )

  expect(screen.getByText(/STX ≈ 0\.10% \+ 2\.00 × WDC/)).toBeInTheDocument()
  expect(screen.getByText(/descriptive/i)).toBeInTheDocument()
  // Two zero lines and the fit.
  expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(3)
})

test('the fit converts fractional coefficients to the percentage axes', () => {
  const [left, right] = fittedLine({ intercept: 0.001, slope: 2 }, [-3, 5])!

  expect(left.x).toBe(-3)
  expect(left.y).toBeCloseTo(-5.9, 12)
  expect(right.x).toBe(5)
  expect(right.y).toBeCloseTo(10.1, 12)
  expect(fittedLine({ intercept: null, slope: null }, [-1, 1])).toBeNull()
})

test('an undefined correlation shows its observations without a misleading line', () => {
  const flat: StockPairScatterOut = {
    status: 'available',
    points: FIVE_POINTS.points.map((point) => ({ ...point, target_return: 0 })),
    intercept: null,
    slope: null,
    reason: 'Returns did not vary, so the correlation and fitted line are undefined.',
  }
  const { container } = render(
    <PairScatterPlot
      targetTicker="WDC"
      item={plotted(flat, { correlation: null })}
      window="six_month"
    />,
  )

  expect(symbols(container)).toBe(5)
  expect(screen.getByText(/Correlation undefined/)).toBeInTheDocument()
  expect(
    screen.getByText(/Returns did not vary, so the correlation and fitted line are undefined\./),
  ).toBeInTheDocument()
  expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(2)
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
})

test('a small sample is plotted but labelled insufficient', () => {
  render(<PairScatterPlot targetTicker="WDC" item={plotted(FIVE_POINTS)} window="six_month" />)

  expect(screen.getByText(/Insufficient data/)).toBeInTheDocument()
  expect(screen.getByText(/at least 100/)).toBeInTheDocument()
})

test('an unavailable plot says why and draws nothing', () => {
  const unavailable: StockPairScatterOut = {
    status: 'unavailable',
    points: [],
    intercept: null,
    slope: null,
    reason: 'Saved prices for STX are malformed.',
  }
  const { container } = render(
    <PairScatterPlot targetTicker="WDC" item={plotted(unavailable)} window="six_month" />,
  )

  expect(screen.getByText('Plot unavailable: Saved prices for STX are malformed.')).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeNull()
})

test('a window saved without a plot says so instead of drawing an empty chart', () => {
  const { container } = render(
    <PairScatterPlot targetTicker="WDC" item={plotted(undefined)} window="six_month" />,
  )

  expect(screen.getByText(/No plot was saved for this window/)).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeNull()
})

test('each window plots its own observations, count and fit', () => {
  const three: StockPairScatterOut = { ...FIVE_POINTS, points: FIVE_POINTS.points.slice(2), slope: 0.5 }
  const item: StockPairItemOut = {
    ...plotted(FIVE_POINTS),
    three_month: {
      ...threeMonth,
      start_date: '2026-09-28',
      end_date: '2026-09-30',
      sample_size: 3,
      scatter: three,
    },
  }

  const { container, rerender } = render(
    <PairScatterPlot targetTicker="WDC" item={item} window="three_month" />,
  )
  expect(symbols(container)).toBe(3)
  expect(screen.getByText(/3 daily returns, Sep 28, 2026 – Sep 30, 2026/)).toBeInTheDocument()
  expect(screen.getByText(/× WDC/)).toHaveTextContent('0.50 × WDC')

  rerender(<PairScatterPlot targetTicker="WDC" item={item} window="six_month" />)
  expect(symbols(container)).toBe(5)
  expect(screen.getByText(/× WDC/)).toHaveTextContent('2.00 × WDC')
})

test('axis domains always include zero and stay usable for flat or tiny ranges', () => {
  expect(paddedDomain([0, 0, 0])).toEqual([-0.5, 0.5])
  const [low, high] = paddedDomain([2, 2])
  expect(low).toBeLessThan(0)
  expect(high).toBeGreaterThan(2)
  const [below, above] = paddedDomain([-12, 25])
  expect(below).toBeLessThan(-12)
  expect(above).toBeGreaterThan(25)
})

test('the tooltip names the session date and both returns', () => {
  render(
    <ScatterTooltipContent
      active
      payload={[{ payload: { date: '2026-09-30', x: 1, y: -0.5 } }]}
      targetTicker="WDC"
      candidateTicker="STX"
    />,
  )

  expect(screen.getByText('Sep 30, 2026')).toBeInTheDocument()
  expect(screen.getByText('WDC: 1.00%')).toBeInTheDocument()
  expect(screen.getByText('STX: -0.50%')).toBeInTheDocument()
})

test('axes snap to round values that include zero', () => {
  expect(niceAxis([-10.15, 13.03])).toEqual({
    domain: [-15, 15],
    ticks: [-15, -10, -5, 0, 5, 10, 15],
  })
  expect(niceAxis([-0.5, 0.5])).toEqual({
    domain: [-0.6, 0.6],
    ticks: [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6],
  })
  expect(niceAxis([-0.16, 2.16]).ticks).toEqual([-0.5, 0, 0.5, 1, 1.5, 2, 2.5])
})
