/**
 * Tiny arithmetic evaluator for bulk-edit formulas like "v * 1000" or
 * "(v - 32) / 1.8". Supports numbers, `v`, + - * /, unary minus, parentheses.
 * (The renderer CSP forbids eval/new Function, hence a hand-rolled parser.)
 */

type Token = number | 'v' | '+' | '-' | '*' | '/' | '(' | ')'

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = []
  const re = /\s*(?:(\d+(?:\.\d+)?)|([v+\-*/()]))/gy
  let pos = 0
  while (pos < src.length) {
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m) return null
    tokens.push(m[1] !== undefined ? Number(m[1]) : (m[2] as Token))
    pos = re.lastIndex
    if (/^\s*$/.test(src.slice(pos))) break
  }
  return tokens
}

export function compileFormula(src: string): ((v: number) => number) | null {
  const tokens = tokenize(src)
  if (!tokens || !tokens.length) return null
  let i = 0

  type Node = (v: number) => number
  function primary(): Node | null {
    const t = tokens![i++]
    if (typeof t === 'number') return () => t
    if (t === 'v') return (v) => v
    if (t === '-') {
      const inner = primary()
      return inner ? (v) => -inner(v) : null
    }
    if (t === '(') {
      const inner = expr()
      if (!inner || tokens![i++] !== ')') return null
      return inner
    }
    return null
  }
  function term(): Node | null {
    let left = primary()
    while (left && (tokens![i] === '*' || tokens![i] === '/')) {
      const op = tokens![i++]
      const right = primary()
      if (!right) return null
      const l = left
      left = op === '*' ? (v) => l(v) * right(v) : (v) => l(v) / right(v)
    }
    return left
  }
  function expr(): Node | null {
    let left = term()
    while (left && (tokens![i] === '+' || tokens![i] === '-')) {
      const op = tokens![i++]
      const right = term()
      if (!right) return null
      const l = left
      left = op === '+' ? (v) => l(v) + right(v) : (v) => l(v) - right(v)
    }
    return left
  }

  const fn = expr()
  if (!fn || i !== tokens.length) return null
  try {
    fn(1) // smoke-run
  } catch {
    return null
  }
  return fn
}
