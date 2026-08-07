import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHealth, listJobs, runJob } from '@/api/system'

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
