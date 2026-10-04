import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import type { ForwardHorizonStatsOut } from '@/types/pair-backtest'
import { formatBacktestReturn } from './pair-backtest-format'
import { PairBacktestReport } from './pair-backtest-report'
import {
  backtestDates,
  backtestWith,
  completedBacktest,
  completedBacktestCalculation,
  insolventBacktest,
  insufficientBacktest,
  noSignalBacktest,
  pendingBacktest,
} from './test-fixtures'

// jsdom has no layout: give charts a fixed size and keep everything else real.
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

function outcomeTable() {
  return screen.getByRole('table', { name: 'WDC outcomes by horizon' })
}

/** The cells of one horizon's row, keyed by column header. */
function horizonRow(horizon: number) {
  const table = outcomeTable()
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '')
  const row = within(table).getByRole('rowheader', { name: `${horizon} sessions` }).closest('tr')!
  const cells = [row.querySelector('th')!, ...Array.from(row.querySelectorAll('td'))]
  return Object.fromEntries(headers.map((header, index) => [header, cells[index].textContent]))
}

function measurement(label: string) {
  const list = screen.getByRole('list', { name: 'Pair simulation results' })
  return within(list).getByText(label).nextSibling?.textContent
}

function withStats(horizon: number, update: Partial<ForwardHorizonStatsOut>) {
  return backtestWith({
    forward_stats: completedBacktestCalculation.forward_stats.map((stats) =>
      stats.horizon_sessions === horizon ? { ...stats, ...update } : stats,
    ),
  })
}

// --- formatting ---------------------------------------------------------------------

test.each([
  [0.0979, '+9.79%'],
  [-0.02298, '-2.30%'],
  [0, '0.00%'],
  [0.00004, '+0.004%'],
  [-0.00004, '-0.004%'],
  [null, '—'],
])('a return fraction of %s reads %s', (value, shown) => {
  expect(formatBacktestReturn(value)).toBe(shown)
})

// --- Stock A alone ------------------------------------------------------------------

test('Stock A outcomes come first, one row per horizon', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  const sections = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
  expect(sections.indexOf('Stock A outcomes')).toBeLessThan(sections.indexOf('Pair simulation'))
  const rows = within(outcomeTable()).getAllByRole('rowheader').map((cell) => cell.textContent)
  expect(rows).toEqual(['3 sessions', '5 sessions', '10 sessions', '20 sessions'])
})

test('each horizon shows its net returns, positive rate, counts, baseline, SPY and convergence', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  expect(horizonRow(3)).toEqual({
    Horizon: '3 sessions',
    Signals: '1 of 1',
    'Mean gross': '+4.00%',
    'Mean net': '+3.80%',
    'Median net': '+3.80%',
    'Positive net': '100%',
    'Usual WDC': '+0.21% (248)',
    'vs SPY': '+2.80% (1 matched)',
    'Beat SPY': '100% (1 matched)',
    'Spread converged': '100% of 1, avg 2.0 sessions (1 converged)',
  })
})

test('a negative Stock A return stays negative while the pair trade made money', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  expect(horizonRow(10)['Mean net']).toBe('-2.30%')
  expect(horizonRow(10)['Spread converged']).toMatch(/^100%/)
  expect(measurement('Total net return (marked)')).toBe('+0.56%')
  expect(screen.getByText(/does not mean WDC rose/)).toBeInTheDocument()
})

test('a horizon without SPY prices on both dates says so instead of showing zero', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  expect(horizonRow(20)['vs SPY']).toBe('— (no SPY match)')
  expect(horizonRow(20)['Beat SPY']).toBe('— (no SPY match)')
  expect(horizonRow(20)['Mean net']).toBe('-5.20%')
})

test('immature horizons are pending, never zero', () => {
  render(<PairBacktestReport report={pendingBacktest} />)

  for (const horizon of [3, 5, 10, 20]) {
    const row = horizonRow(horizon)
    expect(row.Signals).toBe('0 of 1 · 1 pending')
    expect(row['Mean gross']).toBe('Pending')
    expect(row['Mean net']).toBe('Pending')
    expect(row['Positive net']).toBe('Pending')
    expect(row['vs SPY']).toBe('Pending')
    expect(row['Beat SPY']).toBe('Pending')
  }
  expect(outcomeTable()).not.toHaveTextContent('0.00%')
})

test('a rate of 0.1 is 10 percent', () => {
  render(<PairBacktestReport report={withStats(3, { positive_net_rate: 0.1 })} />)

  expect(horizonRow(3)['Positive net']).toBe('10%')
})

test('a positive mean excess does not hide how often matched signals underperformed SPY', () => {
  render(
    <PairBacktestReport
      report={withStats(3, {
        event_count: 5,
        completed_count: 5,
        convergence_rate: 0.2,
        benchmark_matched_count: 5,
        mean_excess_net_return: 0.028,
        positive_excess_rate: 0.2,
      })}
    />,
  )

  expect(horizonRow(3)['vs SPY']).toBe('+2.80% (5 matched)')
  expect(horizonRow(3)['Beat SPY']).toBe('20% (5 matched)')
})

test('average convergence time identifies its converged sample separately from completed outcomes', () => {
  render(
    <PairBacktestReport
      report={withStats(3, {
        event_count: 10,
        completed_count: 10,
        converged_count: 2,
        convergence_rate: 0.2,
        mean_convergence_sessions: 2,
      })}
    />,
  )

  expect(horizonRow(3)['Spread converged']).toBe('20% of 10, avg 2.0 sessions (2 converged)')
})

test('tiny returns keep their sign instead of reading as zero', () => {
  render(
    <PairBacktestReport
      report={withStats(5, { mean_net_return: 0.00004, median_net_return: -0.00004 })}
    />,
  )

  expect(horizonRow(5)['Mean net']).toBe('+0.004%')
  expect(horizonRow(5)['Median net']).toBe('-0.004%')
})

test('gross returns and each signal are in the details, mounted on demand', async () => {
  const user = userEvent.setup()
  render(<PairBacktestReport report={completedBacktest} />)
  expect(screen.queryByRole('table', { name: 'WDC outcome after each signal' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Show WDC signal details' }))

  const details = screen.getByRole('table', { name: 'WDC outcome after each signal' })
  const rows = within(details).getAllByRole('row')
  expect(rows).toHaveLength(5)
  expect(rows[1]).toHaveTextContent('+4.00%')
  expect(rows[1]).toHaveTextContent('+3.80%')
})

test('no qualifying signals is said plainly, with the unconditional baseline still shown', () => {
  render(<PairBacktestReport report={noSignalBacktest} />)

  expect(screen.getAllByText(/No qualifying historical signals/).length).toBeGreaterThan(0)
  expect(horizonRow(3)['Mean net']).toBe('—')
  expect(horizonRow(3)['Mean gross']).toBe('—')
  expect(horizonRow(3)['Beat SPY']).toBe('—')
  expect(horizonRow(3)['Usual WDC']).toBe('+0.21% (248)')
  expect(screen.getByText('No simulated trades')).toBeInTheDocument()
  expect(measurement('Net win rate (closed trades)')).toBe('—')
})

test('insufficient history names the missing coverage and draws nothing', () => {
  render(<PairBacktestReport report={insufficientBacktest} />)

  expect(screen.getByText(/STX has adjusted closes for 400 of the 525 sessions/)).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'WDC outcomes by horizon' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Pair simulation' })).toBeNull()
  expect(screen.queryByRole('figure')).toBeNull()
})

// --- the pair simulation ------------------------------------------------------------

test('the simulation reports marked return, drawdown, counts and the win rate', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  expect(measurement('Total net return (marked)')).toBe('+0.56%')
  expect(measurement('Maximum drawdown')).toBe('0.46%')
  expect(measurement('Final equity')).toBe('10,056.48')
  expect(measurement('Closed trades')).toBe('1')
  expect(measurement('Open trades')).toBe('1')
  expect(measurement('Pending entries')).toBe('0')
  expect(measurement('Skipped episodes')).toBe('0')
  expect(measurement('Net win rate (closed trades)')).toBe('100% of 1')
  expect(screen.getByText(/fewer than 20 closed trades/i)).toBeInTheDocument()
})

test('unrealized P&L and the adjusted-unit proxy are named explicitly', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  const pair = screen.getByRole('region', { name: 'Pair simulation' })
  expect(within(pair).getByText(/includes -46\.20 of unrealized net P&L/)).toBeInTheDocument()
  expect(within(pair).getByText(/adjusted units/)).toBeInTheDocument()
})

test('the trade log shows each trade on demand; an open trade has no exit fill', async () => {
  const user = userEvent.setup()
  render(<PairBacktestReport report={completedBacktest} />)

  await user.click(screen.getByRole('button', { name: 'Show trade log (2)' }))

  const log = screen.getByRole('table', { name: 'Simulated trades' })
  const [, closed, open] = within(log).getAllByRole('row')
  const cells = (row: HTMLElement) =>
    [row.querySelector('th')!, ...Array.from(row.querySelectorAll('td'))].map(
      (cell) => cell.textContent,
    )
  expect(cells(closed)).toEqual([
    'trade-1',
    'Long WDC / short STX',
    'Mar 3, 2026',
    'Mar 4, 2026',
    'Mar 9, 2026',
    'Reversion',
    '1.49',
    '+122.99',
    '19.71',
    '0.60',
    '+102.68',
    '+1.06%',
  ])
  const openCells = cells(open)
  expect(openCells[1]).toBe('Long STX / short WDC')
  expect(openCells[4]).toBe('Open, marked Sep 30, 2026')
  expect(openCells[5]).toBe('—')
  expect(openCells[10]).toBe('-46.20')
})

test('an insolvent simulation keeps its negative equity and a drawdown beyond 100%', () => {
  render(<PairBacktestReport report={insolventBacktest} />)

  expect(measurement('Final equity')).toBe('-1,200.00')
  expect(measurement('Total net return (marked)')).toBe('-112.00%')
  expect(measurement('Maximum drawdown')).toBe('112.00%')
  expect(measurement('Skipped episodes')).toBe('1')
  expect(screen.getByText(/equity fell to zero or below/i)).toBeInTheDocument()
  expect(screen.getByText(/position was closed/i)).toBeInTheDocument()
  expect(screen.queryByText(/liquidation is queued/i)).toBeNull()
})

test('insolvency at the cutoff leaves liquidation pending rather than claiming a filled exit', async () => {
  const user = userEvent.setup()
  const finalDate = backtestDates[251]
  const event = {
    ...pendingBacktest.calculation.events[0],
    event_id: `${backtestDates[249]}:target_low`,
    signal_date: backtestDates[249],
    entry_date: backtestDates[250],
    model: { alpha: 0, hedge_ratio: 1, spread_mean: 0, spread_std: 1, signal_z: -2.5 },
  }
  const openInsolventTrade = {
    ...insolventBacktest.calculation.trades[0],
    event_id: event.event_id,
    signal_date: event.signal_date,
    entry_date: event.entry_date,
    model: event.model,
    status: 'open' as const,
    exit_date: null,
    exit_target_price: null,
    exit_candidate_price: null,
    exit_reason: null,
    exit_signal_date: finalDate,
    pending_exit_reason: 'insolvency' as const,
    last_mark_date: finalDate,
    target_units: 49.333382666716,
    candidate_units: -49.333382666716,
    entry_gross_notional: 9990.009990009989,
    entry_target_price: 100,
    entry_candidate_price: 102.5,
    last_target_price: 100,
    last_candidate_price: 400,
    gross_pnl: -14676.68134334801,
    transaction_cost: 9.99000999000999,
    borrow_cost: 0.4156168539730183,
    net_pnl: -14687.086970191993,
    return_on_entry_gross: -1.4701774057162187,
    holding_sessions: 1,
    calendar_days: 1,
  }
  const report = backtestWith({
    events: [event],
    forward_stats: pendingBacktest.calculation.forward_stats,
    forward_outcomes: pendingBacktest.calculation.forward_outcomes.map((outcome) => ({
      ...outcome,
      event_id: event.event_id,
      entry_date: event.entry_date,
    })),
    trades: [openInsolventTrade],
    equity_curve: pendingBacktest.calculation.equity_curve.map((point, index) => {
      // Flat until the penultimate close's entry fee; the final short-price jump
      // first makes equity negative, leaving no later close to fill the exit.
      const unrealized = index < 250 ? 0 : index === 250 ? -9.99000999000999 : -14687.086970191993
      return {
        ...point,
        equity: 10000 + unrealized,
        realized_net_pnl: 0,
        unrealized_net_pnl: unrealized,
        drawdown: -unrealized / 10000,
        open_trade_id: index < 250 ? null : openInsolventTrade.trade_id,
      }
    }),
    portfolio: {
      ...pendingBacktest.calculation.portfolio!,
      final_equity: -4687.086970191993,
      total_net_return: -1.468708697019199,
      max_drawdown: 1.468708697019199,
      closed_trades: 0,
      open_trades: 1,
      pending_entries: 0,
      skipped_insolvency_events: 0,
      net_win_rate: null,
      reversion_exit_rate: null,
      mean_closed_holding_sessions: null,
      insolvent: true,
    },
  })
  render(<PairBacktestReport report={report} />)

  expect(measurement('Open trades')).toBe('1')
  expect(measurement('Closed trades')).toBe('0')
  expect(measurement('Final equity')).toBe('-4,687.09')
  expect(screen.getByText(/liquidation is queued for the next session's close/i)).toBeInTheDocument()
  expect(screen.queryByText(/position was liquidated|position was closed/i)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Show trade log (1)' }))
  expect(screen.getByRole('table', { name: 'Simulated trades' })).toHaveTextContent('Queued: Insolvency')
})

// --- assumptions and limits ------------------------------------------------------------

test('assumptions and selection limits are visible without opening anything', () => {
  render(<PairBacktestReport report={completedBacktest} />)

  const assumptions = screen.getByRole('region', { name: 'Backtest assumptions' })
  expect(assumptions).toHaveTextContent("next session's close")
  expect(assumptions).toHaveTextContent('10 bps of each filled leg')
  expect(assumptions).toHaveTextContent('3% a year')
  expect(assumptions).toHaveTextContent('10,000.00')
  expect(assumptions).toHaveTextContent(/selected today/)
  expect(assumptions).toHaveTextContent(/adjusted/)
  expect(assumptions).toHaveTextContent('230 supported, 15 not supported, 7 undefined')
  expect(screen.getByText(completedBacktestCalculation.warnings[0])).toBeInTheDocument()
})

test('the report never labels the result as a recommendation or a success', () => {
  for (const report of [completedBacktest, noSignalBacktest, insolventBacktest]) {
    const { container, unmount } = render(<PairBacktestReport report={report} />)
    expect(container).not.toHaveTextContent(/\bbuy\b|profitable|guaranteed|winning strategy/i)
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
    unmount()
  }
})
