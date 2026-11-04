import { DigestItemCard } from '@/features/digest/digest-item-card'
import { sectionMeta, sectionOf } from '@/features/digest/sections'
import type { DigestItem } from '@/types/api'

// Said once per section instead of on every filing card.
const FILING_SECTIONS = new Set(['filing', 'other_filings'])

/** Sections in payload order: the backend already ranked them. */
export function DigestSections({ items, compact = false }: { items: DigestItem[]; compact?: boolean }) {
  if (compact) return <>
    {items.some((item) => FILING_SECTIONS.has(sectionOf(item))) && <p className="text-muted-foreground text-xs">
      8-K item codes name the disclosed topic, not its effect.
    </p>}
    <div className="grid items-start gap-4 sm:grid-cols-2 min-[1664px]:grid-cols-3">
      {items.map((item) => {
        const meta = sectionMeta(sectionOf(item))
        return <section key={item.ticker} aria-label={`${item.ticker} · ${meta.label}`} className="flex min-w-0 flex-col gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <meta.icon className="size-3.5" aria-hidden="true" />{meta.label}
          </h2>
          <DigestItemCard item={item} />
        </section>
      })}
    </div>
  </>
  const grouped = new Map<string, DigestItem[]>()
  for (const item of items) {
    const section = sectionOf(item)
    const bucket = grouped.get(section)
    if (bucket) bucket.push(item)
    else grouped.set(section, [item])
  }
  return (
    <>
      {Array.from(grouped, ([section, sectionItems]) => {
        const meta = sectionMeta(section)
        return (
          <section key={section} className="space-y-3">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 font-semibold">
                <meta.icon className="text-muted-foreground size-4" />
                {meta.label}
                <span className="text-muted-foreground text-sm font-normal">
                  ({sectionItems.length})
                </span>
              </h2>
              {FILING_SECTIONS.has(section) && (
                <p className="text-muted-foreground text-xs">
                  8-K item codes name the disclosed topic, not its effect.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sectionItems.map((item) => (
                <DigestItemCard key={item.ticker} item={item} />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
