import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { ScoreHistoryPointOut } from '@/types/api'
import { ScoreHistoryChart } from './score-history-chart'

let mockResult: { data: ScoreHistoryPointOut[] | undefined; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
}

vi.mock('./hooks', () => ({
  useScoreHistory: () => mockResult,
}))

afterEach(cleanup)

test('explains the empty state instead of rendering a blank chart', () => {
  mockResult = { data: [], isLoading: false }
  render(<ScoreHistoryChart ticker="NVDA" />)
  expect(screen.getByText(/not enough score history yet/i)).toBeInTheDocument()
})

test('treats a single stored day as not enough for a trend', () => {
  mockResult = {
    data: [{ captured_on: '2026-08-30', score: 70, lean: 'bullish' }],
    isLoading: false,
  }
  render(<ScoreHistoryChart ticker="NVDA" />)
  expect(screen.getByText(/not enough score history yet/i)).toBeInTheDocument()
})

test('shows the latest score and the change across the window', () => {
  mockResult = {
    data: [
      { captured_on: '2026-08-29', score: 60, lean: 'neutral' },
      { captured_on: '2026-08-30', score: 72.5, lean: 'bullish' },
    ],
    isLoading: false,
  }
  render(<ScoreHistoryChart ticker="NVDA" />)
  expect(screen.getByText('72.5')).toBeInTheDocument()
  expect(screen.getByText('+12.5')).toBeInTheDocument()
})

test('renders a negative change without a plus sign', () => {
  mockResult = {
    data: [
      { captured_on: '2026-08-29', score: 80, lean: 'bullish' },
      { captured_on: '2026-08-30', score: 62, lean: 'neutral' },
    ],
    isLoading: false,
  }
  render(<ScoreHistoryChart ticker="NVDA" />)
  expect(screen.getByText('-18.0')).toBeInTheDocument()
})
