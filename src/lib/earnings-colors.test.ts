import { describe, expect, it } from 'vitest'
import { classifyEarnings } from './earnings-colors'

describe('EPS comparison accounting basis', () => {
  it('withholds a known ambiguous comparison for both GAAP and adjusted actuals', () => {
    expect(classifyEarnings(-0.76, -0.3098, false)).toEqual({ result: null, surprisePct: null })
    expect(classifyEarnings(-0.01, -0.3098, false)).toEqual({ result: null, surprisePct: null })
  })

  it('continues to classify provider comparisons without a reviewed conflict', () => {
    expect(classifyEarnings(-0.01, -0.3).result).toBe('beat')
    expect(classifyEarnings(-0.76, -0.3, true).result).toBe('miss')
  })
})

it('classifies the sourced adjusted pair while retaining the raw GAAP observation', async () => {
  const { classifyEarningsEvent } = await import('./earnings-colors')
  const result = classifyEarningsEvent({
    eps_actual: -0.76,
    eps_estimate: -0.3098,
    eps_comparison_actual: -0.01,
    eps_comparison_estimate: -0.30,
    eps_comparison_basis: 'adjusted',
    eps_comparison_available: true,
  })
  expect(result.result).toBe('beat')
  expect(result.surprisePct).toBeCloseTo(96.6667, 3)
})

it('does not silently fall back to a GAAP pair if sourced comparison data is incomplete', async () => {
  const { classifyEarningsEvent } = await import('./earnings-colors')
  expect(classifyEarningsEvent({
    eps_actual: -0.76,
    eps_estimate: -0.3098,
    eps_comparison_actual: -0.01,
    eps_comparison_basis: 'adjusted',
    eps_comparison_available: true,
  })).toEqual({ result: null, surprisePct: null })
})

it('uses the UEC adjusted comparison consistently despite a conflicting provider actual', async () => {
  const { classifyEarningsEvent } = await import('./earnings-colors')
  const result = classifyEarningsEvent({
    eps_actual: -0.10, eps_estimate: -0.0471,
    eps_comparison_actual: -0.07, eps_comparison_estimate: -0.04,
    eps_comparison_basis: 'adjusted', eps_comparison_available: true,
  })
  expect(result.result).toBe('miss')
  expect(result.surprisePct).toBeCloseTo(-75)
})
