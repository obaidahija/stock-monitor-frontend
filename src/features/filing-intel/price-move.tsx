import { cn } from '@/lib/utils'
import { formatEasternTime } from '@/lib/format'
import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { sessionLabel } from './labels'
import { entryPrice } from './price-chart-model'

function pct(from: number | null, to: number | null | undefined): number | null {
  return from && to ? (to / from - 1) * 100 : null
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'font-medium',
        value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-red-600 dark:text-red-400' : '',
      )}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

type Prices = Pick<
  FilingIntelFilingOut,
  | 'detected_price'
  | 'detected_price_session'
  | 'detected_price_time'
  | 'ref_close'
  | 'ref_close_date'
  | 'close_1d'
  | 'close_1d_date'
  | 'close_5d'
  | 'close_5d_date'
  | 'pre_filing_price'
  | 'pre_filing_move_pct'
  | 'entry_price'
  | 'entry_price_time'
  | 'entry_price_source'
>

/**
 * Where moves after the filing start: the last price before it was public when known (the
 * press release often crosses the wire before EDGAR accepts the 8-K), else the last close.
 */
export function moveBase(filing: Prices): number | null {
  return entryPrice(filing)
}

/** A move this large between the last close and the filing is shown as already priced in. */
export const PRE_FILING_MOVE_PCT = 3

function PreFilingMove({ filing }: { filing: Prices }) {
  const move = filing.pre_filing_move_pct
  if (move === null || move === undefined || Math.abs(move) < PRE_FILING_MOVE_PCT) return null
  return (
    <span
      className="text-amber-700 dark:text-amber-400"
      title="The stock had already moved this much before the filing reached EDGAR (the news came out first); moves after the filing are measured from the pre-filing price"
    >
      moved {move > 0 ? '+' : ''}
      {move.toFixed(1)}% before the filing
    </span>
  )
}

const ENTRY_SOURCE: Record<string, string> = {
  pre_filing_quote: 'quote just before EDGAR accepted the filing',
  detection_quote: 'quote when the filing was caught',
  last_trade_before: 'last 5-minute trade before the filing (not caught live)',
}

/**
 * Compact move line for a filing row: the last close, the price at filing (the entry), and the
 * moves after it measured from that entry.
 */
export function PriceMove({ filing, now, className }: { filing: Prices; now: QuoteOut | undefined; className?: string }) {
  const base = moveBase(filing)
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums', className)}>
      <span title={filing.ref_close_date ? `Last close before the filing (${filing.ref_close_date})` : undefined}>
        <span className="text-muted-foreground">before </span>
        {filing.ref_close !== null ? `$${filing.ref_close.toFixed(2)}` : '—'}
      </span>
      {base !== null && base !== filing.ref_close && (
        <span
          title={`Price at filing, what the moves after it are measured from: ${
            ENTRY_SOURCE[filing.entry_price_source ?? ''] ?? 'price at filing'
          }${filing.entry_price_time ? `, ${formatEasternTime(filing.entry_price_time)}` : ''}`}
        >
          <span className="text-muted-foreground">at filing </span>${base.toFixed(2)}
        </span>
      )}
      <PreFilingMove filing={filing} />
      <span title={filing.close_1d_date ? `First close after the filing (${filing.close_1d_date})` : 'Next close not in yet'}>
        <span className="text-muted-foreground">+1d </span>
        <Change value={pct(base, filing.close_1d)} />
      </span>
      <span title={filing.close_5d_date ? `Fifth close after the filing (${filing.close_5d_date})` : 'Fifth close not in yet'}>
        <span className="text-muted-foreground">+5d </span>
        <Change value={pct(base, filing.close_5d)} />
      </span>
      <span title={now?.time ? `${sessionLabel(now.session)} quote, ${formatEasternTime(now.time)}` : undefined}>
        <span className="text-muted-foreground">now </span>
        {now ? `$${now.price.toFixed(2)} ` : '— '}
        <Change value={pct(base, now?.price)} />
      </span>
    </span>
  )
}

/** The same numbers as a small table for the filing panel. */
export function PriceTable({ filing, now }: { filing: Prices; now: QuoteOut | undefined }) {
  const base = moveBase(filing)
  const rows: [string, string | null, number | null | undefined][] = [
    ['Last close before the filing', filing.ref_close_date, filing.ref_close],
    ...(filing.detected_price !== null
      ? ([[`${filing.pre_filing_price != null ? 'Before the filing, at detection' : 'At detection'} (${sessionLabel(filing.detected_price_session)})`, filing.detected_price_time ? formatEasternTime(filing.detected_price_time) : null, filing.detected_price]] as [string, string | null, number | null][])
      : []),
    ['First close after (+1 day)', filing.close_1d_date, filing.close_1d],
    ['Fifth close after (+5 days)', filing.close_5d_date, filing.close_5d],
    [`Now${now && now.session !== 'regular' ? ` (${sessionLabel(now.session)})` : ''}`, now?.time ? formatEasternTime(now.time) : null, now?.price],
  ]
  return (
    <table className="w-full text-sm tabular-nums">
      <tbody>
        {rows.map(([label, when, price]) => (
          <tr key={label}>
            <td className="text-muted-foreground py-0.5">{label}</td>
            <td className="text-muted-foreground py-0.5 text-xs">{when ?? ''}</td>
            <td className="py-0.5 text-right">{price !== null && price !== undefined ? `$${price.toFixed(2)}` : '—'}</td>
            <td className="w-20 py-0.5 text-right">
              {label.startsWith('Last close') ? (
                ''
              ) : label.startsWith('Before the filing') ? (
                <Change value={pct(filing.ref_close, price ?? null)} />
              ) : (
                <Change value={pct(base, price ?? null)} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
