import { render, screen, within } from '@testing-library/react'
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
  it('shows each comparison under the label, marked as not counted', () => {
    render(<SignalReasons signal={signal} />)
    expect(screen.getByText(/not counted in the label/i)).toBeInTheDocument()
    expect(screen.getByText(/\$3\.82 vs \$3\.90 consensus/)).toBeInTheDocument()
    expect(screen.getByText(/in line/)).toBeInTheDocument()
  })

  it('flags the row only when guidance is off consensus', () => {
    const off = render(<GuidanceContextBadge signal={signal} />)
    expect(within(off.container).getByText('Guide below consensus')).toBeInTheDocument()
    const inLine = render(<GuidanceContextBadge signal={{ ...signal, context: [signal.context![1]] }} />)
    expect(inLine.container).toBeEmptyDOMElement()
  })
})
