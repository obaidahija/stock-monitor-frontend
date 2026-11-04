import { STAGE_META } from '@/components/shared/stage-badge'
import type { DigestItem } from '@/types/api'
import { SECTION_META, sectionOf } from './sections'

export const DIGEST_FILTER_META = { ...STAGE_META, news_volume: SECTION_META.news_volume }

/** Older saved editions recorded news volume as a section, without a stage. */
export function stagesForDigestFilter(item: DigestItem): string[] {
  return [...new Set([...item.stages, ...(sectionOf(item) === 'news_volume' ? ['news_volume'] : [])])]
}
