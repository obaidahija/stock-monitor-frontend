import { formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MarkerKey, PriceStep } from './price-chart-model'

/** One colour per step, shared by the steps and the chart's dots. */
export const MARKER_COLOR: Record<MarkerKey, string> = {
  before: '#64748b',
  filing: '#f59e0b',
  d1: '#3b82f6',
  d5: '#8b5cf6',
  now: '#10b981',
}

const SHORT_LABEL: Record<Exclude<MarkerKey, 'before'>, string> = {
  filing: 'At filing',
  d1: '+1d',
  d5: '+5d',
  now: 'Now',
}

export function signed(value: number | null): string {
  return value === null ? '' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function changeClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-red-600 dark:text-red-400' : ''
}

function emptyText(step: PriceStep): string {
  if (step.key === 'before') return ''
  return step.key === 'filing' ? 'not caught live' : 'not yet'
}

/**
 * Before → At filing → +1 day → +5 days → Now, each with its change from the price at filing
 * ("At filing" shows the move from the last close). `size="row"` is the list row's version:
 * the same cards, smaller.
 */
export function PriceSteps({ steps, size = 'panel' }: { steps: PriceStep[]; size?: 'panel' | 'row' }) {
  const compact = size === 'row'
  return (
    <ol
      className={cn('grid grid-cols-5', compact ? 'gap-1' : 'gap-1.5')}
      aria-label="Price before and after the filing"
    >
      {steps.map((step) => (
        <li
          key={step.key}
          title={step.time ? `${step.hint} · ${formatEasternDateTime(step.time)}` : step.hint}
          className={cn(
            'border-border rounded-md border',
            compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
            step.key === 'filing' && 'bg-amber-500/5',
          )}
        >
          <div className={cn('text-muted-foreground flex items-center gap-1 whitespace-nowrap', compact ? 'text-[10px] leading-tight' : 'text-[11px]')}>
            <span className={cn('shrink-0 rounded-full', compact ? 'size-1.5' : 'size-2')} style={{ background: MARKER_COLOR[step.key] }} />
            {compact && step.key !== 'before' ? SHORT_LABEL[step.key] : step.label}
          </div>
          {/* The change is the point (where an entry at the filing stands); the price is detail.
              The reference close has no change, so its price takes the large slot. */}
          {step.key === 'before' || step.price === null ? (
            <div className={cn('font-semibold tabular-nums', compact ? 'text-sm leading-tight' : 'text-base')}>
              {step.price !== null ? `$${step.price.toFixed(2)}` : '—'}
            </div>
          ) : (
            <div className={cn('font-bold tabular-nums', compact ? 'text-sm leading-tight' : 'text-base', changeClass(step.change))}>
              {signed(step.change) || '0.0%'}
            </div>
          )}
          <div className={cn('text-muted-foreground tabular-nums', compact ? 'text-[10px] leading-tight' : 'text-xs')}>
            {step.price === null ? emptyText(step) : step.key === 'before' ? '\u00a0' : `$${step.price.toFixed(2)}`}
          </div>
        </li>
      ))}
    </ol>
  )
}
