import { useSyncExternalStore } from 'react'

/** Below Tailwind's `md` breakpoint. */
export const PHONE_MEDIA_QUERY = '(max-width: 767px)'

function canMatchMedia() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** Whether `query` matches now. False where matchMedia is unavailable (jsdom), which renders the desktop layout. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => canMatchMedia() && window.matchMedia(query).matches,
    () => false,
  )
}
