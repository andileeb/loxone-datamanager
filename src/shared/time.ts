import { LOXONE_EPOCH_OFFSET } from './types'

/**
 * Stat timestamps are displayed exactly as stored (no timezone conversion),
 * like LoxStatEdit does — hence the UTC component formatting.
 */
export function loxToUnixSec(ts: number): number {
  return ts + LOXONE_EPOCH_OFFSET
}

export function unixSecToLox(unix: number): number {
  return unix - LOXONE_EPOCH_OFFSET
}

export function loxToDisplay(ts: number): string {
  const d = new Date(loxToUnixSec(ts) * 1000)
  const p = (n: number, l = 2): string => String(n).padStart(l, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

/**
 * Parse an edited timestamp back to a Loxone timestamp; null when invalid.
 * The separator disambiguates the date order: "YYYY-MM-DD", "DD.MM.YYYY",
 * or "MM/DD/YYYY", each followed by " HH:mm(:ss)".
 */
export function displayToLox(text: string): number | null {
  const t = text.trim()
  let y: number, mo: number, d: number, rest: string
  let m = /^(\d{4})-(\d{2})-(\d{2})[T ](.+)$/.exec(t)
  if (m) {
    ;[y, mo, d] = [+m[1], +m[2], +m[3]]
    rest = m[4]
  } else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (.+)$/.exec(t))) {
    ;[d, mo, y] = [+m[1], +m[2], +m[3]]
    rest = m[4]
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (.+)$/.exec(t))) {
    ;[mo, d, y] = [+m[1], +m[2], +m[3]]
    rest = m[4]
  } else {
    return null
  }
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(rest.trim())
  if (!tm) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || +tm[1] > 23) return null
  const unix = Date.UTC(y, mo - 1, d, +tm[1], +tm[2], tm[3] ? +tm[3] : 0) / 1000
  return unixSecToLox(unix)
}
