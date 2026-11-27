import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { PagedList } from '@/components/shared/paged-list'
import { ErrorState } from '@/components/shared/error-state'
import {
  formatCompactNumber,
  formatDate,
  formatEasternDateTimeWithYear,
  formatMoneyAmount,
  formatNumber,
} from '@/lib/format'
import type {
  InsiderTransactionIntent,
  InsiderTransactionOut,
  MajorHolderOut,
  PlannedSaleOut,
} from '@/types/api'
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

const INSIDER_PAGE_SIZE = 25

/** A compact dollar figure with the exact amount on hover. */
function Money({ value, signed = false }: { value: number | null; signed?: boolean }) {
  return (
    <span title={value === null ? undefined : `$${formatNumber(Math.round(value))}`}>
      {formatMoneyAmount(value, { signed })}
    </span>
  )
}

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

const PLANNED_STATUS: Record<PlannedSaleOut['status'], { label: string; hint: string }> = {
  executed: { label: 'Executed', hint: 'The sale has since appeared on a Form 4.' },
  pending: { label: 'Pending', hint: 'No Form 4 sale by this seller yet.' },
  no_form4: {
    label: 'No Form 4',
    hint: 'No Form 4 sale within 10 days. Affiliates and other non-insiders file none.',
  },
}

const BIG_REASONS: Record<string, string> = {
  pct_outstanding: 'large share of the company',
  value: 'large dollar value',
  ceo_cfo: 'CEO/CFO seller',
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return value >= 0.01 ? `${value.toFixed(2)}%` : `${value.toFixed(4)}%`
}

function PlannedSales({ sales }: { sales: PlannedSaleOut[] }) {
  return (
    <section aria-labelledby="planned-sales-heading">
      <Card size="sm">
        <CardHeader>
          <CardTitle id="planned-sales-heading">Planned sales (Form 144)</CardTitle>
          <CardAction className="text-xs text-muted-foreground">
            {sales.length} notice{sales.length === 1 ? '' : 's'}
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Planned date</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">% outstanding</TableHead>
                  <TableHead>Acquired via</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const status = PLANNED_STATUS[sale.status]
                  const role = sale.title ?? sale.relationships.join(' / ')
                  return (
                    <TableRow key={sale.accession_number}>
                      <TableCell className="tabular-nums">
                        {sale.approx_sale_date ? (
                          <time dateTime={sale.approx_sale_date}>
                            {formatDate(sale.approx_sale_date)}
                          </time>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span>{sale.seller_name ?? 'Unnamed seller'}</span>
                          {sale.is_big ? (
                            <Badge
                              title={`Flagged: ${sale.big_reasons
                                .map((reason) => BIG_REASONS[reason] ?? reason)
                                .join(', ')}`}
                            >
                              Big sale
                            </Badge>
                          ) : null}
                          {sale.form_type !== '144' ? (
                            <Badge variant="outline">Amended</Badge>
                          ) : null}
                        </div>
                        {role ? <div className="text-xs text-muted-foreground">{role}</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {sale.units_to_sell === null ? (
                          '—'
                        ) : (
                          <span title={formatNumber(Math.round(sale.units_to_sell))}>
                            {formatCompactNumber(sale.units_to_sell)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Money value={sale.aggregate_market_value} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(sale.pct_outstanding)}
                      </TableCell>
                      <TableCell className="min-w-36 max-w-64 whitespace-normal text-xs">
                        {sale.acquisition_natures.length > 0
                          ? sale.acquisition_natures.join(', ')
                          : '—'}
                        {sale.plan_adoption_dates[0] ? (
                          <div className="text-muted-foreground">
                            10b5-1 plan adopted {sale.plan_adoption_dates[0]}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" title={status.hint}>
                          {status.label}
                        </Badge>
                        {sale.matched_form4_date ? (
                          <div className="text-xs text-muted-foreground">
                            Form 4 {formatDate(sale.matched_form4_date)}
                          </div>
                        ) : null}
                        <a
                          href={sale.edgar_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline underline-offset-2"
                        >
                          EDGAR notice
                        </a>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          A Form 144 is filed when an insider or affiliate starts selling restricted or control
          stock, usually about a day before the Form 4 that reports the sale. Most are sales of
          vested stock compensation.
        </CardFooter>
      </Card>
    </section>
  )
}

/** An amendment whose earlier filing we never stored is an existing stake, not a new one. */
const NO_HISTORY_HINT = 'Amendment: earlier filing not on record, so the change is unknown'

function holderChange(holder: MajorHolderOut): string {
  if (holder.below_threshold) return 'Exited'
  if (holder.filing_count <= 1 || holder.previous_percent === null) {
    return holder.form_type.endsWith('/A') ? '—' : 'New'
  }
  if (holder.percent_change === null) return '—'
  if (holder.percent_change === 0) return 'Unchanged'
  const sign = holder.percent_change > 0 ? '+' : ''
  return `${sign}${holder.percent_change.toFixed(1)} pts`
}

function HolderRow({ holder }: { holder: MajorHolderOut }) {
  const [open, setOpen] = useState(false)
  const hasPurpose = holder.schedule === '13D' && Boolean(holder.purpose)
  return (
    <>
      <TableRow className={holder.below_threshold ? 'opacity-60' : undefined}>
        <TableCell className="min-w-44 max-w-72 whitespace-normal">
          <div className="flex flex-wrap items-center gap-1">
            <span>{holder.holder_name ?? 'Unnamed holder'}</span>
            {holder.related_entities.length > 0 ? (
              <span
                className="text-xs text-muted-foreground"
                title={holder.related_entities.join(', ')}
              >
                +{holder.related_entities.length} related
              </span>
            ) : null}
            {holder.purpose_changed ? <Badge>Purpose changed</Badge> : null}
          </div>
          {hasPurpose ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {open ? 'Hide purpose' : 'Show purpose'}
            </button>
          ) : null}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            title={
              holder.schedule === '13D'
                ? 'Schedule 13D: may seek to influence the company'
                : 'Schedule 13G: passive holder'
            }
          >
            {holder.schedule ?? '—'}
          </Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {holder.below_threshold
            ? '<5%'
            : holder.percent_of_class === null
              ? '—'
              : `${holder.percent_of_class}%`}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {holder.shares === null || holder.below_threshold ? (
            '—'
          ) : (
            <span title={formatNumber(Math.round(holder.shares))}>
              {formatCompactNumber(holder.shares)}
            </span>
          )}
        </TableCell>
        <TableCell
          className="tabular-nums"
          title={
            !holder.below_threshold &&
            (holder.filing_count <= 1 || holder.previous_percent === null) &&
            holder.form_type.endsWith('/A')
              ? NO_HISTORY_HINT
              : undefined
          }
        >
          {holderChange(holder)}
        </TableCell>
        <TableCell className="tabular-nums">
          {holder.event_date ? (
            <time dateTime={holder.event_date}>{formatDate(holder.event_date)}</time>
          ) : '—'}
          <div>
            <a
              href={holder.edgar_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-2"
            >
              EDGAR filing
            </a>
          </div>
        </TableCell>
      </TableRow>
      {open && hasPurpose ? (
        <TableRow>
          <TableCell colSpan={6} className="whitespace-normal text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Stated purpose: </span>
            {holder.purpose}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function MajorHolders({ holders }: { holders: MajorHolderOut[] }) {
  return (
    <section aria-labelledby="major-holders-heading">
      <Card size="sm">
        <CardHeader>
          <CardTitle id="major-holders-heading">Major holders (13D/13G)</CardTitle>
          <CardAction className="text-xs text-muted-foreground">
            {holders.length} holder{holders.length === 1 ? '' : 's'}
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holder</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">% of class</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Event date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holders.map((holder) => (
                  <HolderRow key={holder.accession_number} holder={holder} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Anyone owning more than 5% files a Schedule 13D if they may seek to influence the
          company, or a 13G if they are a passive investor. Each holder shows its latest filing;
          change is against its previous one.
        </CardFooter>
      </Card>
    </section>
  )
}

export function InsiderTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useInsider(ticker)

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading insider activity…</p>
  }
  if (!data) {
    return <ErrorState error={error ?? new Error('Insider activity is unavailable.')} onRetry={() => refetch()} />
  }

  const { summary, transactions } = data
  const warnings = summary.data_quality_warnings ?? []
  const showsPlan = transactions.some((transaction) => {
    const intent = intentOf(transaction)
    return intent === 'ten_b5_1' || intent === 'plan_unspecified'
  })

  return (
    <div className="flex flex-col gap-4">
      {isError ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Couldn’t refresh insider activity. Showing previously loaded activity.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Reported purchases and sales · last {summary.lookback_days} days</CardTitle>
          <CardAction className="flex gap-2">
            {summary.cluster_buy ? <Badge>Cluster buy</Badge> : null}
            {summary.officer_buying ? <Badge variant="secondary">Officer buying</Badge> : null}
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Bought</p>
            <p className="tabular-nums"><Money value={summary.buy_value_usd} /></p>
            <p className="text-xs text-muted-foreground">
              {summary.buy_count} tx · {summary.distinct_buyers} insider(s)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sold</p>
            <p className="tabular-nums"><Money value={summary.sell_value_usd} /></p>
            <p className="text-xs text-muted-foreground">{summary.sell_count} tx</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="tabular-nums"><Money value={summary.net_value_usd} signed /></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latest trade</p>
            <p className="tabular-nums">{formatDate(summary.latest_transaction_date)}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 text-xs text-muted-foreground">
          <p>
            {data.last_successful_sync_at ? (
              <>
                Last successful sync{' '}
                <time dateTime={data.last_successful_sync_at}>
                  {formatEasternDateTimeWithYear(data.last_successful_sync_at)}
                </time>
              </>
            ) : <span>Last successful sync unavailable</span>}
            {' · across tracked stocks'}
          </p>
          {showsPlan ? <p>
            Sales marked 10b5-1 were reported under a plan intended to satisfy Rule 10b5-1, so
            they carry less of a view on the stock than a discretionary sale. “Plan association
            unclear” means the filing set the plan checkbox without saying which of its
            transactions it covered.
          </p> : null}
        </CardFooter>
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

      {data.planned_sales && data.planned_sales.length > 0 ? (
        <PlannedSales sales={data.planned_sales} />
      ) : null}

      {data.major_holders && data.major_holders.length > 0 ? (
        <MajorHolders holders={data.major_holders} />
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
            <PagedList items={transactions} pageSize={INSIDER_PAGE_SIZE}>
              {(rows) => (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trade date</TableHead>
                        <TableHead>Insider</TableHead>
                        <TableHead>Type / security</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Public disclosure / filing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((transaction, index) => {
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
                              {transaction.transaction_date ? (
                                <time dateTime={transaction.transaction_date}>
                                  {formatDate(transaction.transaction_date)}
                                </time>
                              ) : '—'}
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
                            <TableCell className="min-w-44 max-w-72 whitespace-normal">
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
                              {transaction.security_title ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {transaction.security_title}
                                </div>
                              ) : null}
                              {transaction.is_derivative && transaction.underlying_security_title ? (
                                <div className="text-xs text-muted-foreground">
                                  Underlying: {transaction.underlying_security_title}
                                </div>
                              ) : null}
                              {intent === 'ten_b5_1' && transaction.plan_adoption_date ? (
                                <div className="text-xs text-muted-foreground">
                                  Plan adopted {transaction.plan_adoption_date}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {transaction.shares === null ? (
                                '—'
                              ) : (
                                <span title={formatNumber(Math.round(transaction.shares))}>
                                  {formatCompactNumber(transaction.shares)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {transaction.price_per_share === null
                                ? '—'
                                : `$${transaction.price_per_share.toFixed(2)}`}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <Money value={transaction.value_usd} />
                            </TableCell>
                            <TableCell>
                              <div className="mb-1 text-xs text-muted-foreground">
                                {transaction.accepted_at ? (
                                  <time dateTime={transaction.accepted_at}>
                                    {formatEasternDateTimeWithYear(transaction.accepted_at)}
                                  </time>
                                ) : transaction.filed_at ? (
                                  <>
                                    <time dateTime={transaction.filed_at.slice(0, 10)}>
                                      {formatDate(transaction.filed_at.slice(0, 10))}
                                    </time>
                                    <div>Time unavailable</div>
                                  </>
                                ) : 'Disclosure unavailable'}
                              </div>
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
              )}
            </PagedList>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Source: SEC Form 4, Form 144 and Schedule 13D/13G filings. Informational only — not a recommendation.
      </p>
    </div>
  )
}
