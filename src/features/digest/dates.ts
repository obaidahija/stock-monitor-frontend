const easternDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function marketDate(now = new Date()): string {
  const parts = new Map(easternDate.formatToParts(now).map(({ type, value }) => [type, value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

/** Invalid and future bookmarks fall back to today's edition. */
export function normalizeDigestDate(value: string | null | undefined, today: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return undefined
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value : undefined
}
