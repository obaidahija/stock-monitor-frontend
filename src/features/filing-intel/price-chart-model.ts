import type { FilingIntelFilingOut, PricePoint, QuoteOut } from '@/types/filing-intel'

export type MarkerKey = 'before' | 'filing' | 'd1' | 'd5' | 'now'

export interface PriceStep {
  key: MarkerKey
  label: string
  /** When the price was: a session close, the detection quote, or the live quote. */
  time: string | null
  price: number | null
  /** Change from the base (the last price before the filing was public); null for the base. */
  change: number | null
  hint: string
}

type Prices = Pick<
  FilingIntelFilingOut,
  | 'accepted_at'
  | 'ref_close'
  | 'ref_close_date'
  | 'detected_price'
  | 'detected_price_time'
  | 'close_1d'
  | 'close_1d_date'
  | 'close_5d'
  | 'close_5d_date'
  | 'pre_filing_price'
  | 'entry_price'
  | 'entry_price_time'
  | 'entry_price_source'
  | 'ref_close_provisional'
>

/** Whether the filing became public after 4:00 PM New York time (so the day's close preceded it). */
export function filedAfterClose(acceptedAt: string | null): boolean {
  if (!acceptedAt) return false
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false })
    .formatToParts(new Date(acceptedAt))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value) % 24
  return hour >= 16
}

/** A session close at 16:00 New York time, as an ISO instant (EST/EDT read from the date). */
export function closeTime(day: string | null): string | null {
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  // 16:00 ET is 21:00 UTC in winter and 20:00 UTC in summer.
  const probe = new Date(Date.UTC(y, m - 1, d, 21))
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
    .format(probe)
  return new Date(Date.UTC(y, m - 1, d, 21 - (Number(offset) - 16))).toISOString()
}

function pct(price: number | null | undefined, base: number | null | undefined): number | null {
  return price && base ? (price / base - 1) * 100 : null
}

type EntryFields = Pick<FilingIntelFilingOut, 'pre_filing_price' | 'detected_price' | 'ref_close'> & {
  entry_price?: number | null
}

/**
 * The entry: the price when the filing came out, which every move after it is measured from
 * ("if I had bought at the filing, where am I now?"). The quote before EDGAR accepted it when
 * the news crossed the wire first, else the quote when we caught it, else the last close.
 */
export function entryPrice(filing: EntryFields): number | null {
  // The backend's entry also covers filings not caught live (last 5-minute trade before it).
  return filing.entry_price ?? filing.pre_filing_price ?? filing.detected_price ?? filing.ref_close ?? null
}

/** The filing price from somewhere other than the stored quote (the chart's last 5-minute trade). */
export interface FilingPriceOverride {
  price: number
  time: string
  hint: string
}

/**
 * Before -> at filing -> +1 day -> +5 days -> now. "At filing" shows how far the stock had moved
 * from the last close by then (what was missed); every later step is measured from the price at
 * filing.
 */
export function priceSteps(
  filing: Prices,
  now: QuoteOut | undefined,
  override?: FilingPriceOverride,
): PriceStep[] {
  const atFiling = override?.price ?? filing.entry_price ?? filing.pre_filing_price ?? filing.detected_price
  const base = atFiling ?? filing.ref_close
  const afterClose = filedAfterClose(filing.accepted_at)
  return [
    {
      key: 'before',
      label: afterClose ? 'Market close' : 'Prev close',
      time: closeTime(filing.ref_close_date),
      price: filing.ref_close,
      change: null,
      hint:
        (afterClose
          ? "That day's 4:00 PM close: the filing came after it"
          : 'The previous session close: the filing came before or during the next session') +
        (filing.ref_close_provisional ? ' (from the quote when it was caught; confirmed tonight)' : ''),
    },
    {
      key: 'filing',
      label: 'At filing',
      time: override?.time ?? filing.entry_price_time ?? filing.detected_price_time ?? filing.accepted_at,
      price: atFiling ?? null,
      change: pct(atFiling, filing.ref_close),
      hint:
        override?.hint ??
        (filing.entry_price_source === 'last_trade_before'
          ? 'Your entry: the last 5-minute trade before the filing (it was not caught live). Change shown from the last close'
          : filing.pre_filing_price
          ? 'Your entry: the quote just before EDGAR accepted the filing. Change shown from the last close'
          : 'Your entry: the quote when the filing was caught. Change shown from the last close'),
    },
    {
      key: 'd1',
      label: '+1 day',
      time: closeTime(filing.close_1d_date),
      price: filing.close_1d,
      change: pct(filing.close_1d, base),
      hint: 'First session close after the filing, change from the price at filing',
    },
    {
      key: 'd5',
      label: '+5 days',
      time: closeTime(filing.close_5d_date),
      price: filing.close_5d,
      change: pct(filing.close_5d, base),
      hint: 'Fifth session close after the filing, change from the price at filing',
    },
    {
      key: 'now',
      label: 'Now',
      time: now?.time ?? null,
      price: now?.price ?? null,
      change: pct(now?.price, base),
      hint: 'Current price (regular, pre-market or after-hours), change from the price at filing',
    },
  ]
}

/** Index of the bar nearest to a time, or null when the time lies outside the series. */
export function nearestIndex(points: PricePoint[], time: string | null): number | null {
  if (!time || points.length === 0) return null
  const t = Date.parse(time)
  const first = Date.parse(points[0].t)
  const last = Date.parse(points[points.length - 1].t)
  // A day's slack: a daily close sits at 16:00, the 5-minute series may end at 20:00.
  if (t < first - 86_400_000 || t > last + 86_400_000) return null
  let best = 0
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(Date.parse(points[i].t) - t) < Math.abs(Date.parse(points[best].t) - t)) best = i
  }
  return best
}

/** The first bar at or after the filing: where its line is drawn. */
export function filingIndex(points: PricePoint[], acceptedAt: string | null): number | null {
  if (!acceptedAt || points.length === 0) return null
  const t = Date.parse(acceptedAt)
  const i = points.findIndex((p) => Date.parse(p.t) >= t)
  return i === -1 ? points.length - 1 : i
}

/** Runs of pre-market and after-hours bars, shaded so the regular session reads at a glance. */
export function extendedHours(points: PricePoint[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  points.forEach((p, i) => {
    if (p.session === 'regular') return
    const last = out[out.length - 1]
    if (last && last.to === i - 1) last.to = i
    else out.push({ from: i, to: i })
  })
  return out
}
