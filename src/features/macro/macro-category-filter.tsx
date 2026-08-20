import { useSearchParams } from 'react-router'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { MACRO_CATEGORIES, macroCategoryColor, macroCategoryLabel } from './constants'

export function MacroCategoryFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = searchParams.get('category')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  function selectCategory(category: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (category === null || active === category) next.delete('category')
      else next.set('category', category)
      next.delete('page')
      return next
    })
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by macro category">
      <button
        type="button"
        onClick={() => selectCategory(null)}
        aria-pressed={!active}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          !active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        All
      </button>
      {MACRO_CATEGORIES.map((category) => {
        const isActive = active === category
        const color = macroCategoryColor(category, isDark)
        return (
          <button
            key={category}
            type="button"
            onClick={() => selectCategory(category)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            style={
              isActive
                ? { borderColor: color, backgroundColor: `${color}1a` /* ~10% alpha tint */ }
                : undefined
            }
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {macroCategoryLabel(category)}
          </button>
        )
      })}
    </div>
  )
}
