import type { AnalysisLean } from '@/types/api'

export const LEAN_COLOR_CLASSES: Record<AnalysisLean, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  bearish: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
}
