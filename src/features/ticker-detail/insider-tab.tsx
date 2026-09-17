import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InsiderTransactionIntent, InsiderTransactionOut } from '@/types/api'
import { useInsider } from './hooks'

const CODE_LABELS: Record<string, string> = {
  P: 'Buy',
  S: 'Sell',
  A: 'Grant',
  M: 'Option exercise',
  F: 'Tax withheld',
  G: 'Gift',
  C: 'Conversion',
}

// Every badge carries visible text. A row's meaning must never depend on the
// colour alone -- that says nothing to a screen reader, and nothing to anyone
// who cannot tell the hues apart.
const INTENT_LABELS: Record<InsiderTransactionIntent, string> = {
  ten_b5_1: '10b5-1 plan',
  plan_unspecified: 'Plan association unclear',
  tax_withholding: 'Tax withholding',
  other_non_discretionary: 'Non-discretionary',
  unclassified: 'Intent unclassified',
}

const money = (value: number | null) =>
  value === null ? '—' : `$${Math.round(value).toLocaleString()}`

/**
 * Intent for a row, falling back to the legacy flag.
 *
 * A generation-1 response carries only `is_10b5_1`, and that flag was the
 * filing's checkbox copied onto every transaction -- so it is shown as the
 * weaker "plan association unclear" claim rather than asserting this
 * particular row was planned.
 */
function intentOf(transaction: InsiderTransactionOut): InsiderTransactionIntent | null {
  if (transaction.transaction_intent) return transaction.transaction_intent
  return transaction.is_10b5_1 ? 'plan_unspecified' : null
}

function CoOwners({ owners }: { owners: NonNullable<InsiderTransactionOut['reporting_owners']> }) {
  const [expanded, setExpanded] = useState(false)
  const extra = owners.slice(1)
  if (extra.length === 0) return null

  return (
    <div className="text-xs">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        +{extra.length} co-owner{extra.length === 1 ? '' : 's'}
      </button>
      {expanded ? (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {extra.map((owner) => (
            <li key={owner.cik ?? owner.name}>
              {owner.name}
              {owner.title ? ` · ${owner.title}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function InsiderTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useInsider(ticker)

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading insider activity…</p>
  }

  const { summary, transactions } = data
  const warnings = summary.data_quality_warnings ?? []
  const showsPlan = transactions.some((transaction) => {
    const intent = intentOf(transaction)
    return intent === 'ten_b5_1' || intent === 'plan_unspecified'
  })

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Open-market activity · last {summary.lookback_days} days</CardTitle>
          <CardAction className="flex gap-2">
            {summary.cluster_buy ? <Badge>Cluster buy</Badge> : null}
            {summary.officer_buying ? <Badge variant="secondary">Officer buying</Badge> : null}
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Bought</p>
            <p className="tabular-nums">{money(summary.buy_value_usd)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.buy_count} tx · {summary.distinct_buyers} insider(s)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sold</p>
            <p className="tabular-nums">{money(summary.sell_value_usd)}</p>
            <p className="text-xs text-muted-foreground">{summary.sell_count} tx</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="tabular-nums">{money(summary.net_value_usd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latest</p>
            <p className="tabular-nums">{summary.latest_transaction_date ?? '—'}</p>
          </div>
        </CardContent>
        {showsPlan ? (
          <CardFooter className="text-xs text-muted-foreground">
            Sales marked 10b5-1 were reported under a plan intended to satisfy Rule 10b5-1, so
            they carry less of a view on the stock than a discretionary sale. “Plan association
            unclear” means the filing set the plan checkbox without saying which of its
            transactions it covered.
          </CardFooter>
        ) : null}
      </Card>

      {warnings.length > 0 ? (
        <Card size="sm" role="status">
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {warnings.map((warning) => (
              <p key={warning.code}>
                {warning.message} {warning.excluded_event_count} transaction
                {warning.excluded_event_count === 1 ? ' was' : 's were'} excluded from the
                insider score. Filings: {warning.affected_accessions.join(', ')}.
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {transactions.length === 0 ? (
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No insider transactions reported in the last {summary.lookback_days} days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>All reported transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Insider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Filing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction, index) => {
                    const intent = intentOf(transaction)
                    return (
                      <TableRow
                        key={`${transaction.accession_number ?? transaction.insider_name}-${transaction.transaction_date}-${transaction.transaction_code}-${index}`}
                        // Dimmed, never removed: the replaced row is still a
                        // filing that exists, and a reader comparing this to
                        // EDGAR needs to see both versions.
                        className={transaction.is_superseded ? 'opacity-60' : undefined}
                      >
                        <TableCell className="tabular-nums">
                          {transaction.transaction_date ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div>{transaction.insider_name}</div>
                          {transaction.insider_title ? (
                            <div className="text-xs text-muted-foreground">
                              {transaction.insider_title}
                            </div>
                          ) : null}
                          {transaction.reporting_owners ? (
                            <CoOwners owners={transaction.reporting_owners} />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <span>
                              {transaction.transaction_code
                                ? (CODE_LABELS[transaction.transaction_code] ??
                                  transaction.transaction_code)
                                : '—'}
                            </span>
                            {transaction.is_derivative ? (
                              <Badge variant="outline">Derivative</Badge>
                            ) : null}
                            {intent ? <Badge variant="outline">{INTENT_LABELS[intent]}</Badge> : null}
                            {transaction.is_amendment ? (
                              <Badge variant="outline">Amendment</Badge>
                            ) : null}
                            {transaction.is_superseded ? (
                              <Badge variant="outline">Superseded</Badge>
                            ) : null}
                          </div>
                          {intent === 'ten_b5_1' && transaction.plan_adoption_date ? (
                            <div className="text-xs text-muted-foreground">
                              Plan adopted {transaction.plan_adoption_date}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {transaction.shares === null
                            ? '—'
                            : Math.round(transaction.shares).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {transaction.price_per_share === null
                            ? '—'
                            : `$${transaction.price_per_share.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(transaction.value_usd)}
                        </TableCell>
                        <TableCell>
                          {transaction.source_url ? (
                            <a
                              href={transaction.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline underline-offset-2"
                            >
                              SEC filing
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Source: SEC Form 4 filings. Informational only — not a recommendation.
      </p>
    </div>
  )
}
