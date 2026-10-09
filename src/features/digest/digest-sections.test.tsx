import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { DigestItem } from '@/types/api'
import { DigestSections } from './digest-sections'

vi.mock('./digest-item-card', () => ({
  DigestItemCard: ({ item }: { item: DigestItem }) => <article>{item.ticker}</article>,
}))

afterEach(cleanup)

function item(ticker: string, section: string): DigestItem {
  return { ticker, tier: 1, section, stages: [section], reasons: [] } as unknown as DigestItem
}

test('states the 8-K item caveat once per filing section', () => {
  renderWithProviders(
    <DigestSections items={[item('AMFN', 'filing'), item('AVX', 'filing'), item('KMX', 'premarket_gap')]} />,
  )

  expect(screen.getAllByText(/item codes name the disclosed topic, not its effect/i)).toHaveLength(1)
  expect(screen.getByText('AMFN')).toBeInTheDocument()
  expect(screen.getByText('KMX')).toBeInTheDocument()
})
