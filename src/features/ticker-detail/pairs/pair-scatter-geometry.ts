// Pure geometry for the pair scatter plot, in display (percentage) units.

/** A domain containing zero and every value, padded; never zero width. */
export function paddedDomain(values: readonly number[]): [number, number] {
  const finite = values.filter(Number.isFinite)
  const low = Math.min(0, ...finite)
  const high = Math.max(0, ...finite)
  const span = high - low
  if (span < 1e-9) return [low - 0.5, high + 0.5]
  const pad = span * 0.08
  return [low - pad, high + pad]
}

/**
 * The fitted line's ends across ``xDomain`` in percentage units. The API fits
 * fractional returns (candidate = intercept + slope × selected); on percentage
 * axes the intercept is multiplied by 100 and the slope is unchanged.
 */
export function fittedLine(
  fit: { intercept: number | null; slope: number | null },
  xDomain: readonly [number, number],
) {
  const { intercept, slope } = fit
  if (intercept === null || slope === null) return null
  const at = (x: number) => ({ x, y: 100 * intercept + slope * x })
  return [at(xDomain[0]), at(xDomain[1])] as const
}

/** A round tick step giving about six intervals across ``span``. */
function niceStep(span: number) {
  const raw = span / 6
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

/** ``domain`` widened outward to round values, with ticks at each round step. */
export function niceAxis(domain: readonly [number, number]) {
  const [low, high] = domain
  const step = niceStep(high - low)
  const first = Math.floor(low / step)
  const last = Math.ceil(high / step)
  const ticks: number[] = []
  for (let index = first; index <= last; index += 1) {
    // Rounded so float residue (0.6000000000000001) never reaches a label.
    ticks.push(Number((index * step).toFixed(10)))
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]] as [number, number], ticks }
}
