import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WindowRiskChip } from './window-risk-chip'

describe('WindowRiskChip', () => {
  it('renders nothing when there is no scheduled event', () => {
    const { container } = render(<WindowRiskChip windowRisk={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('names the earnings date and countdown', () => {
    render(
      <WindowRiskChip
        windowRisk={{
          level: 'high',
          days: 7,
          earnings_date: '2026-09-24',
          earnings_bmo_amc: 'bmo',
          days_until_earnings: 5,
          macro_events: [],
          note: 'Earnings 2026-09-24 bmo — in 5 days, inside a 7-day window.',
        }}
      />,
    )

    expect(screen.getByText(/Earnings 2026-09-24/)).toBeInTheDocument()
    expect(screen.getByText(/5 calendar days/)).toBeInTheDocument()
  })

  it('names the macro event when there is no earnings date', () => {
    render(
      <WindowRiskChip
        windowRisk={{
          level: 'medium',
          days: 7,
          earnings_date: null,
          earnings_bmo_amc: null,
          days_until_earnings: null,
          macro_events: ['FOMC Interest Rate Decision'],
          note: 'Scheduled inside a 7-day window: FOMC Interest Rate Decision.',
        }}
      />,
    )

    expect(screen.getByText(/FOMC Interest Rate Decision/)).toBeInTheDocument()
  })
})
