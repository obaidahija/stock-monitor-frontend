import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PeerRankLine } from './peer-rank-line'

describe('PeerRankLine', () => {
  it('reads as a rank within a named group', () => {
    render(
      <PeerRankLine
        peerRank={{
          group_kind: 'sector',
          group_label: 'Technology',
          rank: 7,
          group_size: 63,
          percentile: 90.3,
        }}
      />,
    )

    expect(screen.getByText(/#7 of 63 in Technology/)).toBeInTheDocument()
  })

  it('renders nothing without a peer rank', () => {
    const { container } = render(<PeerRankLine peerRank={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
