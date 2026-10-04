import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { PairCorrelations, PairMetrics } from './pair-metrics'
import { fund, newListing, seagate, sixMonth } from './test-fixtures'

afterEach(cleanup)

test('shows a coefficient, historical percentages and an uplift in percentage points', () => {
  render(<PairMetrics item={seagate} window="six_month" />)

  expect(screen.getByText('0.82')).toBeInTheDocument()
  expect(screen.queryByText('82%')).not.toBeInTheDocument()
  expect(screen.getByText('80%')).toBeInTheDocument()
  expect(screen.getByText(/56 of 70/)).toBeInTheDocument()
  expect(screen.getByText('55%')).toBeInTheDocument()
  expect(screen.getByText(/66 of 120/)).toBeInTheDocument()
  expect(screen.getByText('+25 percentage points')).toBeInTheDocument()
  expect(screen.getByText(/120 daily returns/)).toBeInTheDocument()
  expect(screen.getByText(/Apr 8, 2026/)).toBeInTheDocument()
  expect(screen.getByText(/Sep 30, 2026/)).toBeInTheDocument()
})

test('the market-adjusted check is shown separately with its own sample', () => {
  render(<PairMetrics item={seagate} window="six_month" />)

  expect(screen.getByText('0.12')).toBeInTheDocument()
  expect(screen.getByText(/118 daily returns with SPY/)).toBeInTheDocument()
})

test('an unavailable market check says why', () => {
  render(<PairMetrics item={seagate} window="three_month" />)

  expect(screen.getByText('0.65')).toBeInTheDocument()
  expect(screen.getByText(/Unavailable: Only 30 aligned SPY returns/)).toBeInTheDocument()
})

test('undefined measurements render as an em dash', () => {
  render(<PairMetrics item={newListing} window="three_month" />)

  // Correlation, up-day agreement and uplift are all undefined for this window.
  expect(screen.getAllByText('—')).toHaveLength(3)
  expect(screen.queryByText('NaN')).not.toBeInTheDocument()
})

test('a missing window is described instead of showing numbers', () => {
  render(<PairMetrics item={fund} window="six_month" />)

  expect(screen.getByText(/No 6-month measurement/)).toBeInTheDocument()
})

test('a negative uplift keeps its sign', () => {
  const item = {
    ...seagate,
    six_month: { ...sixMonth, up_day_improvement_pp: -4.25 },
  }

  render(<PairMetrics item={item} window="six_month" />)

  expect(screen.getByText('−4.3 percentage points')).toBeInTheDocument()
})

test('both window coefficients are shown together whatever the selected window', () => {
  render(<PairCorrelations item={seagate} />)

  expect(
    screen.getByText('Daily-return correlation: 6 months 0.82 · 3 months 0.65'),
  ).toBeInTheDocument()
})

test('a window without a coefficient shows a dash', () => {
  render(<PairCorrelations item={newListing} />)

  expect(screen.getByText('Daily-return correlation: 6 months — · 3 months —')).toBeInTheDocument()
})
