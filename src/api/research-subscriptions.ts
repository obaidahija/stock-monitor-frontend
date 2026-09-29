import { apiClient } from '@/lib/api-client'
import type {
  ResearchSubscriptionListOut,
  ResearchSubscriptionOrigin,
  ResearchSubscriptionOut,
} from '@/types/api'

/** Stored intraday coverage; never triggers a fetch. */
export function getResearchSubscriptions() {
  return apiClient.get<ResearchSubscriptionListOut>('/v1/research-subscriptions')
}

export function subscribeResearch(origin: ResearchSubscriptionOrigin) {
  return apiClient.post<ResearchSubscriptionOut>('/v1/research-subscriptions', origin)
}

export function unsubscribeResearch(id: number) {
  return apiClient.delete<ResearchSubscriptionOut>(`/v1/research-subscriptions/${id}`)
}
