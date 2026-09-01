import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { InsiderOut, InsiderTransactionOut } from '@/types/api'
import { InsiderTab } from './insider-tab'

let mockData: InsiderOut | undefined

vi.mock('./hooks', () => ({
  useInsider: () => ({ data: mockData, isLoading: false }),
}))

afterEach(cleanup)

const EMPTY: InsiderOut = {
  summary: {
    ticker: 'ABNB',
    lookback_days: 90,
    buy_count: 0,
    buy_value_usd: 0,
    sell_count: 0,
    sell_value_usd: 0,
    distinct_buyers: 0,
    net_value_usd: 0,
    cluster_buy: false,
    officer_buying: false,
    latest_transaction_date: null,
  },
  transactions: [],
}

const BUY: InsiderTransactionOut = {
  insider_name: 'Alice',
  insider_title: 'CEO',
  is_officer: true,
  is_director: false,
  is_ten_percent_owner: false,
  transaction_code: 'P',
  transaction_date: '2026-08-20',
  shares: 1000,
  price_per_share: 500,
  value_usd: 500000,
  shares_owned_after: 5000,
  security_title: 'Common Stock',
  is_derivative: false,
  filed_at: '2026-08-21T00:00:00Z',
  source_url: 'https://www.sec.gov/x.xml',
}

test('explains the empty state', () => {
  mockData = EMPTY
  render(<InsiderTab ticker="ABNB" />)
  expect(screen.getByText(/no insider transactions/i)).toBeInTheDocument()
})

test('shows a cluster-buy badge when several insiders bought', () => {
  mockData = {
    summary: {
      ...EMPTY.summary,
      buy_count: 2,
      buy_value_usd: 900000,
      distinct_buyers: 2,
      cluster_buy: true,
      net_value_usd: 900000,
    },
    transactions: [BUY],
  }
  render(<InsiderTab ticker="ABNB" />)

  expect(screen.getByText(/cluster buy/i)).toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Buy')).toBeInTheDocument()
})

test('labels a compensation code distinctly from an open-market buy', () => {
  mockData = {
    summary: EMPTY.summary,
    transactions: [{ ...BUY, insider_name: 'Bob', transaction_code: 'A' }],
  }
  render(<InsiderTab ticker="ABNB" />)
  expect(screen.getByText('Grant')).toBeInTheDocument()
})
