import { useEffect, useState } from 'react'
import { buildWsUrl } from '@/lib/ws-client'
import type { JobProgressEvent } from '@/types/api'

const MIN_RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 15_000

/**
 * Subscribes to live progress for `jobName` over GET /v1/jobs/{jobName}/ws
 * and connects as soon as it's mounted -- not just after the user clicks
 * "Run" -- so a scheduled run already in flight (e.g. universe_score's
 * 05:30 ET cron) is visible to anyone with the dashboard open. The socket
 * stays open across multiple runs over a day; the server never closes it
 * on "completed".
 */
export function useJobProgress(jobName: string) {
  const [event, setEvent] = useState<JobProgressEvent | null>(null)

  useEffect(() => {
    setEvent(null)
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectDelay = MIN_RECONNECT_DELAY_MS
    let stopped = false

    function connect() {
      if (stopped) return
      socket = new WebSocket(buildWsUrl(`/v1/jobs/${jobName}/ws`))

      socket.onopen = () => {
        reconnectDelay = MIN_RECONNECT_DELAY_MS
      }

      socket.onmessage = (message) => {
        setEvent(JSON.parse(message.data as string) as JobProgressEvent)
      }

      socket.onclose = () => {
        if (stopped) return
        reconnectTimer = setTimeout(connect, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [jobName])

  return event
}
