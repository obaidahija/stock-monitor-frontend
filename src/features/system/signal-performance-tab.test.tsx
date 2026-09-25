import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { SignalPerformanceOut } from '@/types/api'
import { SignalPerformanceTab } from './signal-performance-tab'

let mockData: SignalPerformanceOut | undefined

vi.mock('./hooks', () => ({
  useSignalPerformance: () => ({ data: mockData, isLoading: false }),
}))

vi.mock('./research-performance-panel', () => ({
  ResearchPerformancePanel: () => <div>prospective research panel</div>,
}))

afterEach(cleanup)

test('explains the wait instead of showing an empty table', () => {
  mockData = {
    horizon_days: 5,
    evaluated_count: 0,
    by_lean: [],
    by_score_bucket: [],
    by_factor: [],
  }
  render(<SignalPerformanceTab />)
  expect(screen.getByText(/no outcomes have matured yet/i)).toBeInTheDocument()
})

test('renders factor hit rates and the spread', () => {
  mockData = {
    horizon_days: 5,
    evaluated_count: 42,
    by_lean: [{ lean: 'bullish', count: 42, hit_rate: 0.55, avg_excess_return_pct: 1.2 }],
    by_score_bucket: [],
    by_factor: [
      {
        factor: 'momentum',
        positive_count: 30,
        positive_hit_rate: 0.6,
        negative_count: 12,
        negative_hit_rate: 0.4,
        spread: 0.2,
      },
    ],
  }
  render(<SignalPerformanceTab />)
  expect(screen.getByText('momentum')).toBeInTheDocument()
  expect(screen.getByText(/60\.0%/)).toBeInTheDocument()
  expect(screen.getByText('+0.20')).toBeInTheDocument()
})

test('renders the score calibration section when buckets exist', () => {
  mockData = {
    horizon_days: 5,
    evaluated_count: 42,
    by_lean: [],
    by_score_bucket: [
      { bucket: '40-55', count: 20, hit_rate: 0.45, avg_excess_return_pct: -0.4 },
      { bucket: '70-100', count: 22, hit_rate: 0.62, avg_excess_return_pct: 1.8 },
    ],
    by_factor: [],
  }
  render(<SignalPerformanceTab />)
  expect(screen.getByText(/score calibration/i)).toBeInTheDocument()
})

test('shows an em dash for a factor that has only fired one way', () => {
  mockData = {
    horizon_days: 20,
    evaluated_count: 5,
    by_lean: [],
    by_score_bucket: [],
    by_factor: [
      {
        factor: 'sector',
        positive_count: 5,
        positive_hit_rate: 0.8,
        negative_count: 0,
        negative_hit_rate: null,
        spread: null,
      },
    ],
  }
  render(<SignalPerformanceTab />)
  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
})

test('the legacy dataset stays the default and prospective research is a separate view', () => {
  mockData = {
    horizon_days: 5,
    evaluated_count: 0,
    by_lean: [],
    by_score_bucket: [],
    by_factor: [],
  }
  render(<SignalPerformanceTab />)
  expect(screen.getByRole('tab', { name: 'Legacy composite observations', selected: true }))
    .toBeInTheDocument()
  expect(screen.queryByText('prospective research panel')).not.toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Prospective research observations' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Prospective research observations' }))

  expect(screen.getByText('prospective research panel')).toBeInTheDocument()
})
