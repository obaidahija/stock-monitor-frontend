import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { StageBadge } from './stage-badge'

afterEach(cleanup)

test('renders the insider buy label', () => {
  render(<StageBadge stage="insider_buy" />)
  expect(screen.getByText('Insider buy')).toBeInTheDocument()
})

test('still renders the cluster label on digests stored before the rename', () => {
  render(<StageBadge stage="insider_cluster_buy" />)
  expect(screen.getByText('Insider cluster buy')).toBeInTheDocument()
})

test('renders nothing for an unknown stage', () => {
  const { container } = render(<StageBadge stage="not_a_stage" />)
  expect(container).toBeEmptyDOMElement()
})

test('renders the mention spike badge', () => {
  render(<StageBadge stage="mention_spike" />)
  expect(screen.getByText('Mention spike')).toBeInTheDocument()
})
