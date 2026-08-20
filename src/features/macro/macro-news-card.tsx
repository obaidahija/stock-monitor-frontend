import { useTheme } from 'next-themes'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/format'
import type { MacroNewsItemOut } from '@/types/api'
import { macroCategoryColor, macroCategoryLabel } from './constants'

export function MacroNewsCard({ item }: { item: MacroNewsItemOut }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Card>
      <CardContent className="space-y-2.5 py-4">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>{item.source}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeTime(item.published_at)}</span>
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" className="block">
          <h3 className="font-medium leading-snug hover:underline">{item.title}</h3>
        </a>
        {item.summary && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{item.summary}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {item.classification_pending && (
            <Badge variant="outline" className="text-muted-foreground">
              Classifying…
            </Badge>
          )}
          {item.categories.map((category) => (
            <Badge key={category} variant="outline" className="gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: macroCategoryColor(category, isDark) }}
                aria-hidden="true"
              />
              {macroCategoryLabel(category)}
            </Badge>
          ))}
          {item.sentiment_label && <Badge variant="secondary">{item.sentiment_label}</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}
