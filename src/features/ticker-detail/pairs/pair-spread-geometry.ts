import type { PairStrategyPointOut } from '@/types/pair-strategy'
import { niceAxis, paddedDomain } from './pair-scatter-geometry'

/** A padded vertical axis containing zero, every spread and every band; never zero height. */
export function spreadAxis(points: readonly PairStrategyPointOut[]) {
  const values = points
    .flatMap((point) => [point.spread, point.mean, point.lower_band, point.upper_band])
    .filter((value): value is number => value !== null)
  const axis = niceAxis(paddedDomain(values))
  const step = axis.ticks[1] - axis.ticks[0]
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const scaledStep = step * 10 ** decimals
  // A step such as 0.0025 needs one more decimal place than its magnitude alone.
  const extra = Math.abs(scaledStep - Math.round(scaledStep)) > 1e-8 ? 1 : 0
  return { ...axis, precision: Math.max(2, decimals + extra) }
}
