import { PageHeader } from '@/components/shared/page-header'
import { MacroItemSheet } from '@/features/macro/macro-item-sheet'
import { MacroNewsFeed } from '@/features/macro/macro-news-feed'
import { useOpenMacroItem } from '@/features/macro/open-item'
import { SectorRead } from '@/features/macro/sector-read'
import { WhatsMoving } from '@/features/macro/whats-moving'

export function MacroPage() {
  const { itemId, close } = useOpenMacroItem()
  return (
    <div className="space-y-8">
      <PageHeader
        title="Macro"
        description="What macro news is moving today, how it leans on each sector, and the headlines behind it. Context only, not a score."
      />
      <WhatsMoving />
      <SectorRead />
      <MacroNewsFeed />
      <MacroItemSheet itemId={itemId} onOpenChange={(open) => !open && close()} />
    </div>
  )
}
