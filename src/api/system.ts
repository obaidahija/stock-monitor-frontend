import { apiClient } from '@/lib/api-client'
import type { HealthResponse, JobInfo, JobRunResult, SignalPerformanceOut } from '@/types/api'

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
