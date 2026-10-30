export type ImpactDirection = 'positive' | 'negative' | 'mixed' | 'uncertain'

export const DIRECTION_COLOR_CLASSES: Record<ImpactDirection, string> = {
  positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  negative: 'bg-red-500/10 text-red-700 dark:text-red-400',
  mixed: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  uncertain: 'bg-muted text-muted-foreground',
}
