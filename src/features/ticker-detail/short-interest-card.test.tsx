import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShortInterestCard } from './short-interest-card'

describe('ShortInterestCard', () => {
  it('renders every known field', () => {
    render(
      <ShortInterestCard
        shortInterest={{
          short_percent_of_float: 23.45,
          short_ratio: 4.2,
          float_shares: 51_000_000,
          held_percent_institutions: 74.12,
          held_percent_insiders: 1.83,
        }}
      />,
    )

    // 23.45 renders as 23.4: toFixed rounds the binary double, which sits a
    // hair below 23.45. Matches the backend's f"{...:.1f}" for the same value.
    expect(screen.getByText('23.4%')).toBeInTheDocument()
    expect(screen.getByText('4.2 days')).toBeInTheDocument()
    expect(screen.getByText('74.1%')).toBeInTheDocument()
    expect(screen.getByText('1.8%')).toBeInTheDocument()
  })

  it('renders a dash for individually missing fields', () => {
    render(
      <ShortInterestCard
        shortInterest={{
          short_percent_of_float: 23.45,
          short_ratio: null,
          float_shares: null,
          held_percent_institutions: null,
          held_percent_insiders: null,
        }}
      />,
    )

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders nothing when there is no short interest data', () => {
    const { container } = render(<ShortInterestCard shortInterest={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
