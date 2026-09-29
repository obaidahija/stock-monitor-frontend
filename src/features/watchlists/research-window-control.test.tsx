import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { formatWindowExpiry, parseHorizonSessions } from './research-window'
import { ResearchWindowControl } from './research-window-control'

afterEach(cleanup)

test('selection is explicit and does not perform a save', () => {
  const onChange = vi.fn()
  render(<ResearchWindowControl value={5} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Research window'), { target: { value: '3' } })
  expect(onChange).toHaveBeenCalledWith(3)
  expect(onChange).toHaveBeenCalledTimes(1)
})

test('offers exactly the four selectable session counts', () => {
  render(<ResearchWindowControl value={5} onChange={vi.fn()} />)
  const options = screen.getAllByRole('option').map((option) => option.textContent)
  expect(options).toEqual([
    '1 trading session',
    '3 trading sessions',
    '5 trading sessions',
    '7 trading sessions',
  ])
})

test('a disabled control cannot change the saved window', () => {
  const onChange = vi.fn()
  render(<ResearchWindowControl value={3} onChange={onChange} disabled />)
  expect(screen.getByLabelText('Research window')).toBeDisabled()
})

test.each([
  ['3', 3],
  ['7', 7],
  [null, 5],
  ['', 5],
  ['2', 5],
  ['8', 5],
  ['1.5', 5],
  ['abc', 5],
])('URL value %s resolves to %s sessions', (raw, expected) => {
  expect(parseHorizonSessions(raw)).toBe(expected)
})

test('formats the server expiry in exchange time with the weekday', () => {
  expect(formatWindowExpiry('2026-09-23T20:00:00Z')).toBe('Wed, Sep 23, 4:00 PM ET')
  // Day after Thanksgiving closes early at 13:00 ET.
  expect(formatWindowExpiry('2026-11-27T18:00:00Z')).toBe('Fri, Nov 27, 1:00 PM ET')
})
