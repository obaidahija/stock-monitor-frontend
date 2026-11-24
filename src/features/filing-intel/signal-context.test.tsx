import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FilingSignal } from '@/types/filing-intel'
import { GuidanceContextBadge, SignalReasons } from './signal-badge'

const signal: FilingSignal = {
  label: 'positive',
  strength: 'strong',
  reasons: [{ source: 'results', direction: 'positive', detail: 'adjusted EPS +0.14 vs consensus', evidence: [] }],
  context: [
    {
      source: 'guidance_vs_consensus',
      direction: 'negative',
      detail: 'Q1 adjusted EPS guidance $3.82 vs $3.90 consensus (-2.0%)',
      evidence: ['We are planning for adjusted EPS to be $3.82, +/- $0.20.'],
      counted: false,
    },
    {
      source: 'guidance_vs_consensus',
      direction: 'neutral',
      detail: 'Q1 revenue guidance $4.40B vs $4.40B consensus (-0.1%, in line)',
      evidence: [],
      counted: false,
    },
  ],
  version: 4,
}

describe('guidance vs consensus context', () => {
  it('shows context even when nothing voted', () => {
    const view = within(
      render(
        <SignalReasons
          signal={{
            label: null,
            strength: null,
            reasons: [],
            context: [{ source: 'deal_terms', direction: 'neutral', detail: 'Sells for $1.40B in cash', evidence: [], counted: false }],
            version: 4,
          }}
        />,
      ).container,
    )
    expect(view.getByText(/Sells for \$1\.40B in cash/)).toBeInTheDocument()
  })

  it('labels raise-vs-beat and one-time items', () => {
    const { container } = render(
      <SignalReasons
        signal={{
          ...signal,
          context: [
            { source: 'beat_vs_raise', direction: 'negative', detail: 'about $0.36 lower for the rest of the year', evidence: [], counted: false },
            { source: 'one_time_item', direction: 'neutral', detail: 'includes a $0.22 one-time benefit', evidence: [], counted: false },
            { source: 'deal_terms', direction: 'neutral', detail: 'Sells for $1.40B in cash', evidence: [], counted: false },
          ],
        }}
      />,
    )
    expect(within(container).getByText(/Raise vs beat:/)).toBeInTheDocument()
    expect(within(container).getByText(/One-time item:/)).toBeInTheDocument()
    expect(within(container).getByText(/Deal terms:/)).toBeInTheDocument()
  })

  it('shows each comparison under the label, marked as not counted', () => {
    const view = within(render(<SignalReasons signal={signal} />).container)
    expect(view.getAllByText(/Guidance vs consensus:/).length).toBe(2)
    expect(view.getByText(/not counted in the label/i)).toBeInTheDocument()
    expect(view.getByText(/\$3\.82 vs \$3\.90 consensus/)).toBeInTheDocument()
    expect(view.getByText(/in line/)).toBeInTheDocument()
  })

  it('flags the row only when guidance is off consensus', () => {
    const off = render(<GuidanceContextBadge signal={signal} />)
    expect(within(off.container).getByText('Guide below consensus')).toBeInTheDocument()
    const inLine = render(<GuidanceContextBadge signal={{ ...signal, context: [signal.context![1]] }} />)
    expect(inLine.container).toBeEmptyDOMElement()
  })
})
