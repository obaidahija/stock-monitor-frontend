import { expect, test } from 'vitest'
import { calculateRewardRisk } from './reward-risk'

test.each([
  { entry: 100, stop: 96, target: 112, side: 'long' as const },
  { entry: 100, stop: 104, target: 88, side: 'short' as const },
])('calculates positive price distances and reward/risk for $side setups', (input) => {
  expect(calculateRewardRisk(input)).toEqual({
    status: 'available',
    side: input.side,
    stopDistance: 4,
    stopDistancePct: 4,
    targetDistance: 12,
    targetDistancePct: 12,
    rewardRisk: 3,
  })
})

test('keeps each entry as its own anchor and does not replace it with a quote', () => {
  const levels = Object.freeze({ stop: 96, target: 112 })
  expect(calculateRewardRisk({ ...levels, entry: 100 })).toMatchObject({ rewardRisk: 3 })
  expect(calculateRewardRisk({ ...levels, entry: 98 })).toMatchObject({ rewardRisk: 7 })
  expect(calculateRewardRisk({ ...levels, entry: 106 })).toMatchObject({ rewardRisk: 0.6 })
  expect(levels).toEqual({ stop: 96, target: 112 })
})

test('infers a short reference from its stop and target rather than a research score', () => {
  expect(calculateRewardRisk({ entry: 100, stop: 104, target: 88 })).toMatchObject({
    status: 'available', side: 'short', rewardRisk: 3,
  })
})

test.each([
  { entry: null, stop: 96, target: 112 },
  { entry: 100, stop: null, target: 112 },
  { entry: 100, stop: 96, target: undefined },
])('requires all three reference prices', (input) => {
  expect(calculateRewardRisk(input)).toEqual({ status: 'unavailable', reason: 'missing_prices' })
})

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  'rejects invalid prices (%s) in every position', (price) => {
    for (const input of [
      { entry: price, stop: 96, target: 112 },
      { entry: 100, stop: price, target: 112 },
      { entry: 100, stop: 96, target: price },
    ]) {
      expect(calculateRewardRisk(input)).toEqual({ status: 'unavailable', reason: 'invalid_prices' })
    }
  },
)

test.each([
  { entry: 100, stop: 96, target: 112, side: 'short' as const },
  { entry: 100, stop: 104, target: 88, side: 'long' as const },
  { entry: 100, stop: 96, target: 96 },
])('rejects stop/target geometry that conflicts with the side', (input) => {
  expect(calculateRewardRisk(input)).toEqual({ status: 'unavailable', reason: 'invalid_order' })
})

test.each([95, 96, 112, 113])('does not present a ratio at or beyond a reference boundary (%s)', (entry) => {
  expect(calculateRewardRisk({ entry, stop: 96, target: 112 })).toEqual({
    status: 'unavailable', reason: 'outside_levels',
  })
})

test('keeps small distances without rounding intermediate calculations', () => {
  const result = calculateRewardRisk({ entry: 1, stop: 0.999999, target: 1.000003 })
  expect(result.status).toBe('available')
  if (result.status !== 'available') throw new Error('expected a valid small-price setup')
  expect(result.stopDistance).toBeCloseTo(0.000001, 12)
  expect(result.targetDistance).toBeCloseTo(0.000003, 12)
  expect(result.rewardRisk).toBeCloseTo(3, 8)
})

test('does not expose Infinity when finite inputs overflow a derived metric', () => {
  expect(calculateRewardRisk({ entry: 1, stop: 0.5, target: 1e308 })).toEqual({
    status: 'unavailable', reason: 'unrepresentable',
  })
})
