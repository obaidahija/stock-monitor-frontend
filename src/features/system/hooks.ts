import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHealth, getSignalPerformance, listJobs, runJob } from '@/api/system'
import type { JobRunResult } from '@/types/api'

export function useHealth() {
  return useQuery({ queryKey: ['system', 'health'], queryFn: getHealth, refetchInterval: 30_000 })
}

export function useJobs() {
  return useQuery({ queryKey: ['system', 'jobs'], queryFn: listJobs, refetchInterval: 30_000 })
}

export function useRunJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobName: string) => runJob(jobName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system', 'jobs'] }),
  })
}

/**
 * Runs a list of jobs one at a time, waiting for each to finish before
 * starting the next — for job chains where a later job depends on data
 * an earlier one just wrote (e.g. sentiment_classify needs news_ingest
 * to have inserted news rows first).
 */
export function useRunJobsInOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      jobNames,
      onStepSettled,
    }: {
      jobNames: string[]
      onStepSettled: (jobName: string, result: JobRunResult | null, error?: unknown) => void
    }) => {
      for (const jobName of jobNames) {
        try {
          const result = await runJob(jobName)
          queryClient.invalidateQueries({ queryKey: ['system', 'jobs'] })
          onStepSettled(jobName, result)
          if (result.status !== 'success') break
        } catch (error) {
          onStepSettled(jobName, null, error)
          break
        }
      }
    },
  })
}

export function useSignalPerformance(horizon: 5 | 20) {
  return useQuery({
    queryKey: ['system', 'signal-performance', horizon],
    queryFn: () => getSignalPerformance(horizon),
  })
}
