/**
 * Whether `incoming` was generated before `current`, so a late response can never
 * replace a newer saved report for the same ordered pair. Date.parse handles
 * time-zone offsets but drops the backend's microseconds, so equal milliseconds
 * fall back to comparing the fractional seconds as written.
 */
export function isOlderPairReport(
  incoming: { generated_at: string },
  current: { generated_at: string } | null | undefined,
): boolean {
  if (!current) return false
  const incomingTime = Date.parse(incoming.generated_at)
  const currentTime = Date.parse(current.generated_at)
  if (incomingTime !== currentTime) return incomingTime < currentTime
  const fraction = (timestamp: string) => (timestamp.match(/\.(\d+)/)?.[1] ?? '').padEnd(9, '0')
  return fraction(incoming.generated_at) < fraction(current.generated_at)
}
