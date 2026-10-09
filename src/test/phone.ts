import { vi } from 'vitest'
import { PHONE_MEDIA_QUERY } from '@/lib/use-media-query'

/** Makes useMediaQuery report a phone. Undo with vi.unstubAllGlobals(). */
export function emulatePhone() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PHONE_MEDIA_QUERY,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}
