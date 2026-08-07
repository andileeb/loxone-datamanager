import { reactive, watch } from 'vue'

export type DateFormat = 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type TimeFormat = '24h' | '12h'

const STORAGE_KEY = 'ldm.prefs'

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
export const prefs = reactive({
  // 24h and DD.MM.YYYY are the defaults for every language (changeable in settings)
  dateFormat: (saved.dateFormat ?? 'DD.MM.YYYY') as DateFormat,
  timeFormat: (saved.timeFormat ?? '24h') as TimeFormat
})
watch(prefs, () => localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)))

const p = (n: number, l = 2): string => String(n).padStart(l, '0')

export function formatDateParts(y: number, m: number, d: number): string {
  switch (prefs.dateFormat) {
    case 'MM/DD/YYYY':
      return `${p(m)}/${p(d)}/${y}`
    case 'YYYY-MM-DD':
      return `${y}-${p(m)}-${p(d)}`
    default:
      return `${p(d)}.${p(m)}.${y}`
  }
}

export function formatTimeParts(h: number, min: number, s?: number): string {
  const sec = s === undefined ? '' : `:${p(s)}`
  if (prefs.timeFormat === '12h') {
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${p(h12)}:${p(min)}${sec} ${ampm}`
  }
  return `${p(h)}:${p(min)}${sec}`
}

/** local-time display for real dates (file mtimes etc.) */
export function formatDateTime(date: Date): string {
  return `${formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())} ${formatTimeParts(date.getHours(), date.getMinutes(), date.getSeconds())}`
}

/**
 * Stat timestamps in the editor grid: date per preference, time always 24h so
 * the field stays unambiguous to parse when edited.
 */
export function loxToDisplayPref(ts: number, epochOffset: number): string {
  const d = new Date((ts + epochOffset) * 1000)
  return `${formatDateParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}
