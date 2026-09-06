// RSS-sourced summaries (Google News, Yahoo Finance) often carry raw HTML
// markup (<a>, <font>, &nbsp;) in what's meant to be a plain-text field.
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatSignedPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // value is a plain calendar date ("YYYY-MM-DD", no time/timezone --
  // backend Pydantic `date` fields serialize this way). `new Date(value)`
  // parses that as UTC midnight, so toLocaleDateString in any timezone
  // behind UTC (e.g. America/Vancouver) rolls it back a day. Parse the
  // components directly into a local-timezone Date instead so the
  // calendar date displayed always matches the one the backend sent.
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEasternDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
  return `${formatted} ET`
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  const now = Date.now()
  const diffSeconds = Math.round((now - then) / 1000)

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      return rtf.format(Math.round(-diffSeconds / secondsInUnit), unit)
    }
  }
  return 'just now'
}

/** 82 -> "82nd". The teens are the exception to the last-digit rule
 * (11th/12th/13th, not 11st/12nd/13rd), so they are checked first. */
export function formatOrdinal(value: number): string {
  const n = Math.round(value)
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
