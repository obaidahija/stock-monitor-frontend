import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { PriceReferenceLadder } from './price-reference-ladder'

afterEach(cleanup)

test('adds separate entry and report-price reward/risk to the AI reference card', () => {
  render(<PriceReferenceLadder
    priceReference={{ entry_primary: 100, entry_secondary: 98, stop_loss: 96, take_profit: 112, note: 'Saved research levels.' }}
    currentPrice={106}
  />)
  expect(screen.getByText('Saved research levels.')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Primary entry reward/risk' })).getByText('3.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Secondary entry reward/risk' })).getByText('7.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Report price comparison reward/risk' })).getByText('0.60 : 1')).toBeInTheDocument()
})

test('AI short references use their geometry without requiring a lean prop', () => {
  render(<PriceReferenceLadder priceReference={{ entry_primary: 100, entry_secondary: null, stop_loss: 104, take_profit: 88, note: '' }} currentPrice={102} />)
  expect(within(screen.getByRole('group', { name: 'Primary entry reward/risk' })).getByText('3.00 : 1')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Report price comparison reward/risk' })).getByText('7.00 : 1')).toBeInTheDocument()
})

test('the incomplete-reference grid exposes an unavailable calculation', () => {
  render(<PriceReferenceLadder priceReference={{ entry_primary: 100, entry_secondary: null, stop_loss: null, take_profit: null, note: '' }} currentPrice={null} />)
  expect(within(screen.getByRole('group', { name: 'Primary entry reward/risk' })).getByText(/Unavailable.*required/)).toBeInTheDocument()
})
