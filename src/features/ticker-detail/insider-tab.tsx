import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
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

const money = (value: number | null) =>
  value === null ? '—' : `$${Math.round(value).toLocaleString()}`

export function InsiderTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useInsider(ticker)

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading insider activity…</p>
  }

  const { summary, transactions } = data

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
      </Card>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction, index) => (
                    <TableRow
                      key={`${transaction.insider_name}-${transaction.transaction_date}-${transaction.transaction_code}-${index}`}
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
                      </TableCell>
                      <TableCell>
                        {transaction.transaction_code
                          ? (CODE_LABELS[transaction.transaction_code] ??
                            transaction.transaction_code)
                          : '—'}
                        {transaction.is_derivative ? (
                          <span className="text-xs text-muted-foreground"> (derivative)</span>
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
                    </TableRow>
                  ))}
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
