import { apiClient } from '@/lib/api-client'
import type { HealthResponse, JobInfo, JobRunResult } from '@/types/api'

export function getHealth() {
  return apiClient.get<HealthResponse>('/v1/health')
}

export function listJobs() {
  return apiClient.get<JobInfo[]>('/v1/jobs')
}

export function runJob(jobName: string) {
  return apiClient.post<JobRunResult>(`/v1/jobs/${encodeURIComponent(jobName)}/run`)
}
