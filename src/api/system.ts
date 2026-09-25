import { ApiError, apiClient, apiFetch } from '@/lib/api-client'
import type {
  HealthResponse,
  JobInfo,
  JobRunResult,
  ResearchObservationPageOut,
  ResearchPerformanceFilters,
  ResearchPerformanceOut,
  SignalPerformanceOut,
} from '@/types/api'

export function getHealth() {
  return apiClient.get<HealthResponse>('/v1/health')
}

export function listJobs() {
  return apiClient.get<JobInfo[]>('/v1/jobs')
}

export function runJob(jobName: string) {
  return apiClient.post<JobRunResult>(`/v1/jobs/${encodeURIComponent(jobName)}/run`)
}

export function getSignalPerformance(horizon: 5 | 20) {
  return apiClient.get<SignalPerformanceOut>(`/v1/signal-performance?horizon=${horizon}`)
}

/** Query string for a prospective cohort; omitted filters are left out entirely. */
export function researchQuery(filters: ResearchPerformanceFilters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  return params.toString()
}

export function getResearchPerformance(filters: ResearchPerformanceFilters) {
  return apiClient.get<ResearchPerformanceOut>(`/v1/research-performance?${researchQuery(filters)}`)
}

export function getResearchObservations(
  filters: ResearchPerformanceFilters,
  page: number,
  pageSize: number,
) {
  const query = researchQuery(filters, { page: String(page), page_size: String(pageSize) })
  return apiClient.get<ResearchObservationPageOut>(`/v1/research-performance/observations?${query}`)
}

/** Download the cohort's CSV (sent with the API key, which a plain link cannot carry). */
export async function downloadResearchExport(filters: ResearchPerformanceFilters) {
  const response = await apiFetch(`/v1/research-performance/export?${researchQuery(filters)}`)
  if (!response.ok) {
    let detail: unknown = null
    try {
      detail = (await response.json())?.detail
    } catch {
      // no JSON body
    }
    throw new ApiError(response.status, detail)
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'research-observations.csv'
  link.click()
  URL.revokeObjectURL(url)
}
