/** Best-effort natural-language time extraction from a quick-add string.
 *
 *   "Gym 7am"                 -> { title: "Gym", start: "07:00" }
 *   "Review 14:00-15:30"      -> { title: "Review", start: "14:00", end: "15:30" }
 *   "Call 3pm to 4pm"         -> { title: "Call", start: "15:00", end: "16:00" }
 *   "Read 2 chapters"         -> { title: "Read 2 chapters" }   (no time)
 */

function to24(hm: string, ap?: string): string | null {
  const parts = hm.split(':')
  let h = Number(parts[0])
  const m = parts[1] != null ? Number(parts[1]) : 0
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59) return null

  if (ap) {
    const p = ap.toLowerCase()
    if (h < 1 || h > 12) return null
    if (p === 'pm' && h < 12) h += 12
    if (p === 'am' && h === 12) h = 0
  } else {
    // no am/pm: only accept an unambiguous 24h value, and for a bare hour
    // require it to read as a plausible time (>= 5) so "Read 2" isn't 02:00
    if (h > 23) return null
    if (parts[1] == null && h < 5) return null
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const NUM = '(\\d{1,2}(?::\\d{2})?)'
const AP = '\\s*(am|pm)?'
const RANGE = new RegExp(
  `\\s+(?:from\\s+)?${NUM}${AP}\\s*(?:-|–|—|to)\\s*${NUM}${AP}\\s*$`,
  'i',
)
const SINGLE = new RegExp(`\\s+(?:at\\s+|@\\s*)?${NUM}${AP}\\s*$`, 'i')

export interface ParsedTask {
  title: string
  start?: string
  end?: string
}

export function parseTaskInput(raw: string): ParsedTask {
  const s = raw.trim()

  const rm = s.match(RANGE)
  if (rm && rm.index != null) {
    // a trailing am/pm applies to both ends when only one is written
    const shared = rm[4] || rm[2]
    const start = to24(rm[1], rm[2] || shared)
    const end = to24(rm[3], rm[4] || shared)
    if (start) {
      return {
        title: s.slice(0, rm.index).trim() || s,
        start,
        end: end ?? undefined,
      }
    }
  }

  const sm = s.match(SINGLE)
  if (sm && sm.index != null) {
    const start = to24(sm[1], sm[2])
    if (start) return { title: s.slice(0, sm.index).trim() || s, start }
  }

  return { title: s }
}
