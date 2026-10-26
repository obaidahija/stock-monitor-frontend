export type RewardRiskSide = 'long' | 'short'

export interface RewardRiskLevels {
  entry_primary: number | null
  entry_secondary?: number | null
  stop_loss: number | null
  take_profit: number | null
}

export type RewardRiskResult =
  | {
      status: 'available'
      side: RewardRiskSide
      stopDistance: number
      stopDistancePct: number
      targetDistance: number
      targetDistancePct: number
      rewardRisk: number
    }
  | {
      status: 'unavailable'
      reason: 'missing_prices' | 'invalid_prices' | 'invalid_order' | 'outside_levels' | 'unrepresentable'
    }

/** Price geometry only: no execution assumptions, probability, or trade grading. */
export function calculateRewardRisk({
  entry,
  stop,
  target,
  side,
}: {
  entry: number | null | undefined
  stop: number | null | undefined
  target: number | null | undefined
  side?: RewardRiskSide
}): RewardRiskResult {
  if (entry == null || stop == null || target == null) {
    return { status: 'unavailable', reason: 'missing_prices' }
  }
  if (![entry, stop, target].every((price) => Number.isFinite(price) && price > 0)) {
    return { status: 'unavailable', reason: 'invalid_prices' }
  }

  const direction = side ?? (stop < target ? 'long' : 'short')
  if (direction === 'long' ? stop >= target : target >= stop) {
    return { status: 'unavailable', reason: 'invalid_order' }
  }
  const stopDistance = direction === 'long' ? entry - stop : stop - entry
  const targetDistance = direction === 'long' ? target - entry : entry - target
  if (stopDistance <= 0 || targetDistance <= 0) {
    return { status: 'unavailable', reason: 'outside_levels' }
  }

  const stopDistancePct = (stopDistance / entry) * 100
  const targetDistancePct = (targetDistance / entry) * 100
  const rewardRisk = targetDistance / stopDistance
  if (![stopDistance, targetDistance, stopDistancePct, targetDistancePct, rewardRisk].every(
    (value) => Number.isFinite(value) && value > 0,
  )) {
    return { status: 'unavailable', reason: 'unrepresentable' }
  }

  return {
    status: 'available',
    side: direction,
    stopDistance,
    stopDistancePct,
    targetDistance,
    targetDistancePct,
    rewardRisk,
  }
}
