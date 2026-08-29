/** "07:00:00" -> "07:00"; null -> "—" */
export function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : '—'
}

/** Local date as YYYY-MM-DD (matches how the backend stores scheduled_date). */
export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

/** Parse a YYYY-MM-DD string as a local Date (no timezone drift). */
export function parseISO(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

/** Shift a YYYY-MM-DD string by n days. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

export function minutesToHM(total: number): string {
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** minutes past midnight for "HH:MM[:SS]", or null. */
export function minutesOfDay(time: string | null): number | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
