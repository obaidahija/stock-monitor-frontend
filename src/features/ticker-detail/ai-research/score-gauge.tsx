import { LEAN_COLOR_CLASSES } from '@/lib/lean-colors'
import { cn } from '@/lib/utils'
import type { AnalysisLean } from '@/types/api'

const RADIUS = 80
const HALF_CIRCUMFERENCE = Math.PI * RADIUS
const ARC_PATH = `M 20 100 A ${RADIUS} ${RADIUS} 0 0 1 180 100`

const STROKE_TEXT_CLASSES: Record<AnalysisLean, string> = {
  bullish: 'text-emerald-600 dark:text-emerald-400',
  bearish: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
}

export function ScoreGauge({
  score,
  confidence,
  lean,
}: {
  score: number
  confidence: number
  lean: AnalysisLean
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * HALF_CIRCUMFERENCE

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative w-full max-w-64', STROKE_TEXT_CLASSES[lean])}>
        <svg viewBox="0 0 200 110" className="w-full">
          <path
            d={ARC_PATH}
            fill="none"
            className="text-muted"
            stroke="currentColor"
            strokeWidth={16}
            strokeLinecap="round"
          />
          <path
            d={ARC_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${HALF_CIRCUMFERENCE}`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums">{Math.round(clamped)}</span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      </div>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize',
          LEAN_COLOR_CLASSES[lean],
        )}
      >
        {lean}
      </span>
      <span className="text-muted-foreground text-xs">
        {Math.round(confidence)}% confidence
      </span>
    </div>
  )
}
