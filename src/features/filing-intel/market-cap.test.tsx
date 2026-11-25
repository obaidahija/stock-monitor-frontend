import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { formatMarketCap, MarketCapBadge, marketCapBand } from './market-cap'

test('market caps read in dollars with a size band', () => {
  expect(formatMarketCap(412e6)).toBe('$412M')
  expect(formatMarketCap(3.6e10)).toBe('$36.0B')
  expect(formatMarketCap(2.1e12)).toBe('$2.1T')
  expect([75e6, 900e6, 5e9, 50e9].map((v) => marketCapBand(v).label)).toEqual([
    'micro cap',
    'small cap',
    'mid cap',
    'large cap',
  ])
})

test('the badge shows nothing without a cap', () => {
  const { container } = render(<MarketCapBadge value={null} />)
  expect(container).toBeEmptyDOMElement()
  render(<MarketCapBadge value={75e6} size="lg" />)
  expect(screen.getByText('$75.0M')).toBeInTheDocument()
  expect(screen.getByText('· micro cap')).toBeInTheDocument()
})
