import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { StageBadge } from './stage-badge'

afterEach(cleanup)

test('renders the insider cluster buy label', () => {
  render(<StageBadge stage="insider_cluster_buy" />)
  expect(screen.getByText('Insider cluster buy')).toBeInTheDocument()
})

test('renders nothing for an unknown stage', () => {
  const { container } = render(<StageBadge stage="not_a_stage" />)
  expect(container).toBeEmptyDOMElement()
})
