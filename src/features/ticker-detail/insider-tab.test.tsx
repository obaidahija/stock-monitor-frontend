import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    signal_score: null,
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
  is_10b5_1: false,
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

test('renders a response with none of the provenance fields', () => {
  // A generation-1 backend omits every additive field, and its is_10b5_1 was
  // the filing's checkbox copied onto every row -- which is precisely the
  // weaker "unclear" claim, so it must not be shown as a known plan.
  mockData = {
    summary: EMPTY.summary,
    transactions: [{ ...BUY, transaction_code: 'S', is_10b5_1: true }],
  }
  render(<InsiderTab ticker="ABNB" />)

  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getAllByText(/plan association unclear/i).length).toBeGreaterThan(0)
})

test('distinguishes a known plan from a filing that never said which row it covered', () => {
  mockData = {
    summary: { ...EMPTY.summary, sell_count: 2, planned_event_count: 2 },
    transactions: [
      {
        ...BUY,
        insider_name: 'Planned Pat',
        transaction_code: 'S',
        is_10b5_1: true,
        transaction_intent: 'ten_b5_1',
        intent_basis: 'linked_footnote',
        plan_adoption_date: '2026-05-14',
      },
      {
        ...BUY,
        insider_name: 'Unclear Uma',
        transaction_code: 'S',
        is_10b5_1: true,
        transaction_intent: 'plan_unspecified',
        intent_basis: 'document_checkbox',
      },
    ],
  }
  render(<InsiderTab ticker="ABNB" />)

  const table = screen.getByRole('table')
  expect(within(table).getByText(/^10b5-1 plan$/i)).toBeInTheDocument()
  expect(within(table).getByText(/^plan association unclear$/i)).toBeInTheDocument()
})

test('labels tax withholding and unclassified intent with visible text', () => {
  mockData = {
    summary: { ...EMPTY.summary, sell_count: 2, tax_withholding_event_count: 1 },
    transactions: [
      {
        ...BUY,
        insider_name: 'Taxed Tess',
        transaction_code: 'S',
        transaction_intent: 'tax_withholding',
        intent_basis: 'linked_footnote',
      },
      {
        ...BUY,
        insider_name: 'Plain Pam',
        transaction_code: 'S',
        transaction_intent: 'unclassified',
        intent_basis: 'none',
      },
    ],
  }
  render(<InsiderTab ticker="ABNB" />)

  // Visible text, not colour alone: a badge that only differs by hue says
  // nothing to a screen reader or to anyone who cannot distinguish it.
  expect(screen.getByText(/tax withholding/i)).toBeInTheDocument()
  expect(screen.getByText(/intent unclassified/i)).toBeInTheDocument()
})

test('describes a plan as intended to satisfy Rule 10b5-1 rather than adopted months ahead', () => {
  mockData = {
    summary: { ...EMPTY.summary, sell_count: 1, planned_event_count: 1 },
    transactions: [
      {
        ...BUY,
        transaction_code: 'S',
        is_10b5_1: true,
        transaction_intent: 'ten_b5_1',
      },
    ],
  }
  render(<InsiderTab ticker="ABNB" />)

  expect(
    screen.getByText(/reported under a plan intended to satisfy Rule 10b5-1/i),
  ).toBeInTheDocument()
})

test('reveals co-owners from a keyboard-accessible control', async () => {
  mockData = {
    summary: { ...EMPTY.summary, buy_count: 1, buy_value_usd: 500000 },
    transactions: [
      {
        ...BUY,
        insider_name: 'Doe Jane',
        reporting_owners: [
          {
            name: 'Doe Jane',
            cik: '0000111111',
            title: 'CFO',
            is_officer: true,
            is_director: false,
            is_ten_percent_owner: false,
          },
          {
            name: 'Roe Richard',
            cik: '0000222222',
            title: null,
            is_officer: false,
            is_director: true,
            is_ten_percent_owner: false,
          },
          {
            name: 'Fund GP LLC',
            cik: '0000333333',
            title: null,
            is_officer: false,
            is_director: false,
            is_ten_percent_owner: true,
          },
        ],
      },
    ],
  }
  render(<InsiderTab ticker="ABNB" />)

  const toggle = screen.getByRole('button', { name: /\+2 co-owners/i })
  expect(screen.queryByText('Roe Richard')).not.toBeInTheDocument()

  toggle.focus()
  await userEvent.keyboard('{Enter}')

  expect(screen.getByText('Roe Richard')).toBeInTheDocument()
  expect(screen.getByText('Fund GP LLC')).toBeInTheDocument()
})

test('marks a superseded row without removing it', () => {
  mockData = {
    summary: { ...EMPTY.summary, sell_count: 1 },
    transactions: [
      {
        ...BUY,
        insider_name: 'Original Olive',
        transaction_code: 'S',
        accession_number: 'ORIG',
        is_superseded: true,
      },
      {
        ...BUY,
        insider_name: 'Amended Amy',
        transaction_code: 'S',
        accession_number: 'AMD',
        is_amendment: true,
        amends_accession: 'ORIG',
      },
    ],
  }
  render(<InsiderTab ticker="ABNB" />)

  expect(screen.getByText('Original Olive')).toBeInTheDocument()
  expect(screen.getByText(/superseded/i)).toBeInTheDocument()
  expect(screen.getByText(/^amendment$/i)).toBeInTheDocument()
})

test('warns that ambiguous transactions were excluded from the score', () => {
  mockData = {
    summary: {
      ...EMPTY.summary,
      excluded_ambiguous_event_count: 2,
      scoreable_event_count: 0,
      data_quality_warnings: [
        {
          code: 'unresolved_duplicate',
          message:
            'Separate filings report an identical trade with no evidence that the filers are related.',
          affected_accessions: ['ACC-A', 'ACC-B'],
          excluded_event_count: 2,
        },
      ],
    },
    transactions: [BUY],
  }
  render(<InsiderTab ticker="ABNB" />)

  const warning = screen.getByRole('status')
  expect(warning).toHaveTextContent(/excluded from the insider score/i)
  expect(warning).toHaveTextContent(/ACC-A/)
})

test('links a transaction to its SEC filing', () => {
  mockData = { summary: EMPTY.summary, transactions: [BUY] }
  render(<InsiderTab ticker="ABNB" />)

  const link = screen.getByRole('link', { name: /filing/i })
  expect(link).toHaveAttribute('href', 'https://www.sec.gov/x.xml')
})

test('does not render the raw signal score as a second unexplained number', () => {
  mockData = {
    summary: { ...EMPTY.summary, buy_count: 1, signal_score: -0.7162978701990244 },
    transactions: [BUY],
  }
  render(<InsiderTab ticker="ABNB" />)

  expect(screen.queryByText(/-0\.71/)).not.toBeInTheDocument()
})
