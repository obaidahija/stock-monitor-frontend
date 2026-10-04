import { cleanup, render, screen, within } from '@testing-library/react'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { EquityTooltipContent, PairBacktestEquityChart } from './pair-backtest-equity-chart'
import {
  backtestDates,
  completedBacktest,
  insolventBacktest,
  insufficientBacktest,
  noSignalBacktest,
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

function equityRows() {
  return within(
    screen.getByRole('table', { name: 'Daily illustrative equity of WDC against STX' }),
  ).getAllByRole('row')
}

function cells(row: HTMLElement) {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

test('every one of the 252 saved equity points is drawn and listed by date', () => {
  const { container } = render(<PairBacktestEquityChart report={completedBacktest} />)

  expect(
    screen.getByRole('figure', { name: 'Illustrative equity of the WDC/STX pair simulation' }),
  ).toBeInTheDocument()
  expect(container.querySelector('path.recharts-line-curve')).not.toBeNull()
  const rows = equityRows()
  expect(rows).toHaveLength(253)
  expect(rows[1]).toHaveTextContent('Oct 14, 2025')
  expect(rows[252]).toHaveTextContent('Sep 30, 2026')
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
})

test('the table shows equity, realized and unrealized P&L, drawdown and the open trade', () => {
  render(<PairBacktestEquityChart report={completedBacktest} />)

  const rows = equityRows()
  // The entry day: the entry fee is an unrealized cost and a drawdown from 10,000.
  expect(cells(rows[102])).toEqual(['Mar 4, 2026', '9,990.28', '0.00', '-9.72', '0.10%', 'trade-1'])
  expect(cells(rows[252])).toEqual([
    'Sep 30, 2026',
    '10,056.48',
    '+102.68',
    '-46.20',
    '0.46%',
    'trade-2',
  ])
})

test('negative equity and drawdown beyond 100% are shown as they are', () => {
  render(<PairBacktestEquityChart report={insolventBacktest} />)

  const final = cells(equityRows()[252])
  expect(final[1]).toBe('-1,200.00')
  expect(final[4]).toBe('112.00%')
  expect(screen.getByText(/below zero/)).toBeInTheDocument()
})

test('without trades the curve is flat at the starting capital', () => {
  render(<PairBacktestEquityChart report={noSignalBacktest} />)

  const rows = equityRows()
  expect(rows).toHaveLength(253)
  expect(new Set(rows.slice(1).map((row) => cells(row)[1]))).toEqual(new Set(['10,000.00']))
})

test('insufficient price coverage draws no curve', () => {
  render(<PairBacktestEquityChart report={insufficientBacktest} />)

  expect(screen.queryByRole('figure')).toBeNull()
  expect(screen.getByText(/No equity curve/)).toBeInTheDocument()
})

test('the tooltip names the date, equity and its parts', () => {
  const point = completedBacktest.calculation.equity_curve[251]
  render(<EquityTooltipContent active payload={[{ payload: point }]} />)

  expect(screen.getByText('Sep 30, 2026')).toBeInTheDocument()
  expect(screen.getByText('Equity: 10,056.48')).toBeInTheDocument()
  expect(screen.getByText('Realized net P&L: +102.68')).toBeInTheDocument()
  expect(screen.getByText('Unrealized net P&L: -46.20')).toBeInTheDocument()
  expect(screen.getByText('Drawdown: 0.46%')).toBeInTheDocument()
  expect(backtestDates[251]).toBe('2026-09-30')
})

test('the table can be reached and scrolled with the keyboard', () => {
  render(<PairBacktestEquityChart report={completedBacktest} />)

  const region = screen.getByRole('region', { name: 'Daily equity values' })
  expect(region).toHaveAttribute('tabindex', '0')
})
