// Display formatting for saved backtests. The API sends returns and rates as
// fractions (0.1 = 10%); each is converted to a percentage exactly once, here.

const DASH = '—'

const TWO_PLACES = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const SIGNED_TWO_PLACES = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})
const TINY = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 2 })
const SIGNED_TINY = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 2,
  signDisplay: 'exceptZero',
})

/** Two decimals, except a nonzero value that two decimals would show as zero. */
function twoPlaces(value: number, signed: boolean) {
  if (value !== 0 && Math.abs(value) < 0.005) {
    return (signed ? SIGNED_TINY : TINY).format(value)
  }
  return (signed ? SIGNED_TWO_PLACES : TWO_PLACES).format(value)
}

/** A return fraction as a signed percentage: 0.0979 reads +9.79%, 0.00004 reads +0.004%. */
export function formatBacktestReturn(value: number | null): string {
  if (value === null) return DASH
  return `${twoPlaces(value * 100, true)}%`
}

/** An unsigned percentage such as a drawdown, which may exceed 100%. */
export function formatBacktestPercent(value: number | null): string {
  if (value === null) return DASH
  return `${twoPlaces(value * 100, false)}%`
}

/** A share of a sample (0 to 1) as a percentage: 0.1 reads 10%, 0.625 reads 62.5%. */
export function formatBacktestRate(value: number | null): string {
  if (value === null) return DASH
  return `${Number((value * 100).toFixed(1))}%`
}

/** Illustrative money in adjusted-price units; P&L is signed. */
export function formatBacktestMoney(value: number | null, { signed = false } = {}): string {
  if (value === null) return DASH
  return twoPlaces(value, signed)
}
