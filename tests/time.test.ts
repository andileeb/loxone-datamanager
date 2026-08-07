import { describe, expect, it } from 'vitest'
import { displayToLox, loxToDisplay } from '../src/shared/time'

const lox = loxToDisplay // "YYYY-MM-DD HH:mm:ss"

describe('displayToLox (multi-format timestamp parsing)', () => {
  const expected = displayToLox('2026-05-01 14:30:00')!

  it('round-trips the ISO grid format', () => {
    expect(lox(expected)).toBe('2026-05-01 14:30:00')
  })
  it('parses DD.MM.YYYY', () => {
    expect(displayToLox('01.05.2026 14:30:00')).toBe(expected)
    expect(displayToLox('1.5.2026 14:30')).toBe(displayToLox('2026-05-01 14:30:00'))
  })
  it('parses MM/DD/YYYY', () => {
    expect(displayToLox('05/01/2026 14:30:00')).toBe(expected)
  })
  it('rejects invalid input', () => {
    for (const bad of [
      '',
      'yesterday',
      '2026-05-01',
      '32.05.2026 10:00',
      '01.13.2026 10:00',
      '01.05.2026 25:00'
    ]) {
      expect(displayToLox(bad), bad).toBeNull()
    }
  })
})
