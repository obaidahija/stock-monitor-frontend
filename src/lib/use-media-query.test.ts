import { renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { emulatePhone } from '@/test/phone'
import { PHONE_MEDIA_QUERY, useMediaQuery } from './use-media-query'

afterEach(() => vi.unstubAllGlobals())

test('is false where matchMedia does not exist', () => {
  const { result } = renderHook(() => useMediaQuery(PHONE_MEDIA_QUERY))
  expect(result.current).toBe(false)
})

test('follows the media query', () => {
  emulatePhone()
  const { result } = renderHook(() => useMediaQuery(PHONE_MEDIA_QUERY))
  expect(result.current).toBe(true)
})
