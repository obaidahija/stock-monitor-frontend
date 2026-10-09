import { expect, test } from 'vitest'
import { squarify } from './treemap-layout'

test('areas are proportional to values and fill the bounds', () => {
  const rects = squarify([60, 30, 10], { x: 0, y: 0, w: 200, h: 100 })
  const areas = rects.map((r) => r.w * r.h)
  expect(areas[0]).toBeCloseTo(12000)
  expect(areas[1]).toBeCloseTo(6000)
  expect(areas[2]).toBeCloseTo(2000)
  for (const r of rects) {
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(200 + 1e-6)
    expect(r.y + r.h).toBeLessThanOrEqual(100 + 1e-6)
  }
})

test('keeps input order and gives zero values an empty rect', () => {
  const rects = squarify([0, 5, 5], { x: 10, y: 20, w: 100, h: 50 })
  expect(rects[0].w * rects[0].h).toBe(0)
  expect(rects[1].w * rects[1].h).toBeCloseTo(2500)
})
