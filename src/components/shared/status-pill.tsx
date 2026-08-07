import { cn } from '@/lib/utils'

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={cn('size-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-red-500')}
        aria-hidden
      />
      <span className={ok ? 'text-foreground' : 'text-red-600 dark:text-red-400'}>{label}</span>
    </span>
  )
}
