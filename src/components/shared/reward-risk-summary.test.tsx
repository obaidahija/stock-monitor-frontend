import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { RewardRiskSummary } from './reward-risk-summary'

afterEach(cleanup)

const levels = Object.freeze({
  entry_primary: 100, entry_secondary: 98, stop_loss: 96, take_profit: 112,
})

test('shows independent primary, secondary and comparison calculations', () => {
  render(<RewardRiskSummary levels={levels} comparison={{ label: 'Report price comparison', price: 106 }} />)

  const primary = within(screen.getByRole('group', { name: 'Primary entry reward/risk' }))
  expect(primary.getByText('$100.00')).toBeInTheDocument()
  expect(primary.getByText('$4.00')).toBeInTheDocument()
  expect(primary.getByText('4.00%')).toBeInTheDocument()
  expect(primary.getByText('$12.00')).toBeInTheDocument()
  expect(primary.getByText('12.00%')).toBeInTheDocument()
  expect(primary.getByText('3.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Secondary entry reward/risk' })).getByText('7.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Report price comparison reward/risk' })).getByText('0.60 : 1')).toBeInTheDocument()
})

test('a quote-only update leaves saved entry calculations intact', () => {
  const { rerender } = render(<RewardRiskSummary levels={levels} comparison={{ label: 'Quoted price comparison', price: 106 }} />)
  rerender(<RewardRiskSummary levels={levels} comparison={{ label: 'Quoted price comparison', price: 107 }} />)

  expect(within(screen.getByRole('group', { name: 'Primary entry reward/risk' })).getByText('3.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Secondary entry reward/risk' })).getByText('7.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Quoted price comparison reward/risk' })).getByText('0.45 : 1')).toBeInTheDocument()
  expect(levels.entry_primary).toBe(100)
})

test('supports inferred short references and omits an absent secondary entry', () => {
  render(<RewardRiskSummary levels={{ entry_primary: 100, stop_loss: 104, take_profit: 88 }} />)
  expect(screen.getByText('3.00 : 1')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Secondary entry reward/risk' })).not.toBeInTheDocument()
})

test('does not manufacture a positive ratio for a conflicting saved side or out-of-range quote', () => {
  const { rerender } = render(<RewardRiskSummary levels={levels} side="short" />)
  expect(screen.getAllByText(/Unavailable.*conflict with the setup side/)).toHaveLength(2)
  expect(screen.queryByText('3.00 : 1')).not.toBeInTheDocument()

  rerender(<RewardRiskSummary levels={levels} comparison={{ label: 'Quoted price comparison', price: 113 }} />)
  const quote = within(screen.getByRole('group', { name: 'Quoted price comparison reward/risk' }))
  expect(quote.getByText(/Unavailable.*at or beyond the stop\/target/)).toBeInTheDocument()
  expect(screen.getByText('3.00 : 1')).toBeInTheDocument()
})

test('handles missing references and calculates a valid secondary independently', () => {
  const { rerender } = render(<RewardRiskSummary levels={null} />)
  expect(screen.getByText(/Unavailable.*Entry, stop and target are required/)).toBeInTheDocument()
  rerender(<RewardRiskSummary levels={{ ...levels, entry_primary: null }} />)
  expect(within(screen.getByRole('group', { name: 'Primary entry reward/risk' })).getByText(/Unavailable.*required/)).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Secondary entry reward/risk' })).getByText('7.00 : 1')).toBeInTheDocument()
})

test('keeps sub-cent distances and sub-hundredth ratios visibly positive', () => {
  const { rerender } = render(<RewardRiskSummary levels={{ entry_primary: 1, stop_loss: 0.999999, take_profit: 1.000003 }} />)
  expect(screen.getByText('$0.000001')).toBeInTheDocument()
  expect(screen.getByText('0.0001%')).toBeInTheDocument()
  expect(screen.getByText('3.00 : 1')).toBeInTheDocument()
  rerender(<RewardRiskSummary levels={{ entry_primary: 100, stop_loss: 1, take_profit: 100.000001 }} />)
  expect(screen.getByText('0.00000001 : 1')).toBeInTheDocument()
  expect(screen.queryByText('0.00 : 1')).not.toBeInTheDocument()
})
