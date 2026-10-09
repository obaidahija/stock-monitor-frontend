import { expect, test } from 'vitest'
import { centerHorizontally } from './scroll'

function box(left: number, width: number) {
  const element = document.createElement('div')
  element.getBoundingClientRect = () =>
    ({ left, width, top: 0, height: 0, right: left + width, bottom: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
  let scrollLeft = 0
  Object.defineProperty(element, 'scrollLeft', {
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value
    },
  })
  return element
}

test('moves a child to the middle of its scroller', () => {
  const container = box(0, 300)
  centerHorizontally(container, box(500, 100))
  expect(container.scrollLeft).toBe(400)
})

test('never scrolls before the start', () => {
  const container = box(0, 300)
  centerHorizontally(container, box(20, 50))
  expect(container.scrollLeft).toBe(0)
})
