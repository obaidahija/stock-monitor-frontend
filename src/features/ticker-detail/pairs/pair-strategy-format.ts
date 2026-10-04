const DASH = '—'

/**
 * Rounded for display, with extra digits whenever rounding would carry the value to
 * the other side of a decision threshold: a z-score of -1.9999 never reads -2.00.
 */
function formatPreservingSide(value: number, digits: number, side: (value: number) => boolean) {
  for (let shown = digits; shown <= digits + 4; shown += 1) {
    const text = value.toFixed(shown)
    if (side(Number(text)) === side(value)) return text
  }
  return String(value)
}

export function formatZScore(value: number | null, entryZ: number) {
  if (value === null) return DASH
  const text = formatPreservingSide(value, 2, (z) => Math.abs(z) >= entryZ)
  return value > 0 ? `+${text}` : text
}

// A test statistic's p-value: never a confidence level.
export function formatPValue(value: number | null, significance: number) {
  if (value === null) return DASH
  if (value < 0.0001) return '< 0.0001'
  return formatPreservingSide(value, 4, (p) => p < significance)
}

/**
 * Four significant figures: a hedge ratio of 0.000667 (BRK.B against BRK.A) reads
 * 0.000667, never 0.001 or 0.000, so it can never appear to cross its "> 0" check.
 */
export function formatHedgeRatio(value: number | null) {
  if (value === null) return DASH
  return String(Number(value.toPrecision(4)))
}
