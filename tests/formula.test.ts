import { describe, expect, it } from 'vitest'
import { compileFormula } from '../src/renderer/src/lib/formula'

describe('compileFormula', () => {
  const cases: Array<[string, number, number]> = [
    ['v', 5, 5],
    ['v * 1000', 2.5, 2500],
    ['v - 100', 150, 50],
    ['(v - 32) / 1.8', 212, 100],
    ['-v', 3, -3],
    ['2 + 3 * 4', 0, 14],
    ['(2 + 3) * 4', 0, 20],
    ['v / 2 + v / 2', 7, 7],
    ['--v', 4, 4]
  ]
  for (const [src, input, expected] of cases) {
    it(`evaluates "${src}" (${input} → ${expected})`, () => {
      const fn = compileFormula(src)
      expect(fn).not.toBeNull()
      expect(fn!(input)).toBeCloseTo(expected, 10)
    })
  }

  it('rejects invalid input', () => {
    for (const bad of ['', 'x + 1', 'v +', '(v', 'v ** 2', '1;alert(1)', 'v..1', ')(']) {
      expect(compileFormula(bad), bad).toBeNull()
    }
  })
})
