import { cn } from '@/lib/utils'
import { formatEasternTime } from '@/lib/format'
import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { sessionLabel } from './labels'

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
>

/**
 * Compact move line for a filing row. Moves are measured from the last close before the
 * filing was public (available for every filing, so history is comparable); the live
 * detection price is shown when the filing was caught live.
 */
export function PriceMove({ filing, now, className }: { filing: Prices; now: QuoteOut | undefined; className?: string }) {
  const base = filing.ref_close ?? filing.detected_price
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums', className)}>
      <span title={filing.ref_close_date ? `Last close before the filing (${filing.ref_close_date})` : undefined}>
        <span className="text-muted-foreground">before </span>
        {filing.ref_close !== null ? `$${filing.ref_close.toFixed(2)}` : '—'}
      </span>
      {filing.detected_price !== null && (
        <span
          title={
            filing.detected_price_time
              ? `${sessionLabel(filing.detected_price_session)} quote at detection, ${formatEasternTime(filing.detected_price_time)}`
              : undefined
          }
        >
          <span className="text-muted-foreground">detected </span>${filing.detected_price.toFixed(2)}
        </span>
      )}
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
  const base = filing.ref_close ?? filing.detected_price
  const rows: [string, string | null, number | null | undefined][] = [
    ['Last close before the filing', filing.ref_close_date, filing.ref_close],
    ...(filing.detected_price !== null
      ? ([[`At detection (${sessionLabel(filing.detected_price_session)})`, filing.detected_price_time ? formatEasternTime(filing.detected_price_time) : null, filing.detected_price]] as [string, string | null, number | null][])
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
              {label.startsWith('Last close') ? '' : <Change value={pct(base, price ?? null)} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
