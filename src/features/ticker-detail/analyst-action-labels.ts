import type { PriceTargetChangeOut } from '@/types/api'

// yfinance's upgrades_downgrades action codes, confirmed against live data:
// main (7.5k, the overwhelming majority -- same grade, target usually revised),
// init (657, new coverage, never a prior target), reit (632, same grade, almost
// always the SAME target too -- a true no-change reiteration), up (522, always a
// grade change), down (476, always a grade change). 'main' specifically reads as
// "Reiterated" only in the rare case its own target didn't move either, since
// that's indistinguishable from a true reiteration without the pct check.
//
// Shared by the Analyst Detail table/callout (analysis-tab.tsx) and the
// ticker-page banner (price-target-change-banner.tsx) so the same underlying
// event is never described with different wording in different places.
export function actionLabel(event: Pick<PriceTargetChangeOut, 'action' | 'pct_change'>): string {
  switch (event.action) {
    case 'up':
      return 'Upgraded'
    case 'down':
      return 'Downgraded'
    case 'init':
      return 'Initiated coverage'
    case 'reit':
      return 'Reiterated'
    case 'main':
      return event.pct_change ? 'Price target revised' : 'Reiterated'
    default:
      return 'Rating update'
  }
}

export const ACTION_BADGE_CLASSES: Record<string, string> = {
  Upgraded: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Downgraded: 'bg-red-500/15 text-red-600 dark:text-red-400',
  'Initiated coverage': 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  Reiterated: 'bg-muted text-muted-foreground',
  'Price target revised': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Rating update': 'bg-muted text-muted-foreground',
}

/** "From → To" only when they actually differ -- showing e.g. "Buy → Buy" for
 * a same-grade action reads as a typo, not a reiteration. */
export function gradeText(event: Pick<PriceTargetChangeOut, 'from_grade' | 'to_grade'>) {
  return event.from_grade && event.to_grade && event.from_grade !== event.to_grade
    ? `${event.from_grade} → ${event.to_grade}`
    : (event.to_grade ?? event.from_grade ?? null)
}
