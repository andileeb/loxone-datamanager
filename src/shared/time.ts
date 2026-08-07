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

/** parse "YYYY-MM-DD HH:mm:ss" back to a Loxone timestamp; null when invalid */
export function displayToLox(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (!m) return null
  const unix = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0) / 1000
  return unixSecToLox(unix)
}
