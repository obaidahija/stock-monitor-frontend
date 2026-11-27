import { cn } from '@/lib/utils'
import type { NewsAnalysisLabel, NewsAnalysisSummaryOut } from '@/types/api'

const LABEL_META: Record<NewsAnalysisLabel, { text: string; className: string }> = {
  strong_positive: {
    text: 'Strong positive',
    className: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
  },
  positive: { text: 'Positive', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  neutral: { text: 'Neutral', className: 'bg-muted text-muted-foreground' },
  negative: { text: 'Negative', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  strong_negative: {
    text: 'Strong negative',
    className: 'bg-red-600 text-white dark:bg-red-500 dark:text-red-950',
  },
}

/** Overall read of an article from its business factors (local model, not headline tone). */
export function NewsAnalysisBadge({
  label,
  status,
  className,
}: {
  label?: NewsAnalysisLabel | null
  status?: NewsAnalysisSummaryOut['status']
  className?: string
}) {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'
  if (status && status !== 'readable') {
    return (
      <span className={cn(base, 'border border-dashed text-muted-foreground', className)}>
        {status === 'unreadable' ? 'Unreadable' : 'Not analyzed yet'}
      </span>
    )
  }
  if (!label) return <span className="text-muted-foreground text-xs">—</span>
  const meta = LABEL_META[label]
  return <span className={cn(base, meta.className, className)}>{meta.text}</span>
}
