import { describe, expect, it } from 'vitest'
import { parseListDate } from '../src/main/ftp'

const now = new Date('2026-08-07T12:00:00Z')

describe('parseListDate (Miniserver LIST dates, UTC, no year)', () => {
  it('parses a yearless date earlier this year', () => {
    expect(parseListDate('Mar  5 09:30', now)).toBe('2026-03-05T09:30:00.000Z')
  })
  it('assumes last year for dates that would be in the future', () => {
    expect(parseListDate('Nov 08 21:01', now)).toBe('2025-11-08T21:01:00.000Z')
  })
  it('parses an explicit year', () => {
    expect(parseListDate('Nov 08 2023', now)).toBe('2023-11-08T00:00:00.000Z')
  })
  it('returns null for garbage or missing input', () => {
    expect(parseListDate(undefined, now)).toBeNull()
    expect(parseListDate('yesterday', now)).toBeNull()
  })
})
