import { app } from 'electron'
import { closeSync, mkdirSync, openSync, readdirSync, readSync, statSync } from 'fs'
import { join } from 'path'
import type { CachedFile } from '../shared/types'
import { STAT_FILENAME_RE } from '../shared/types'

export function cacheDir(host: string): string {
  const safe = host.replace(/[^a-zA-Z0-9.-]/g, '_')
  const dir = join(app.getPath('userData'), 'stats-cache', safe)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** name is renderer-supplied — the regex check doubles as path-traversal protection */
export function cachePath(host: string, name: string): string {
  if (!STAT_FILENAME_RE.test(name)) throw new Error(`Invalid statistics file name: ${name}`)
  return join(cacheDir(host), name)
}

/** Read just the stat name out of a file header without loading the whole file. */
function peekName(path: string): string | null {
  try {
    const fd = openSync(path, 'r')
    try {
      const head = Buffer.alloc(4096)
      const n = readSync(fd, head, 0, head.length, 0)
      if (n < 13) return null
      const textLen = head.readInt32LE(8)
      if (textLen <= 0 || 12 + textLen > n) return null
      return head.toString('utf8', 12, 12 + textLen)
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

export function listCache(host: string): CachedFile[] {
  const dir = cacheDir(host)
  const files: CachedFile[] = []
  for (const name of readdirSync(dir)) {
    if (!STAT_FILENAME_RE.test(name)) continue
    const path = join(dir, name)
    const st = statSync(path)
    files.push({
      name,
      size: st.size,
      modifiedAt: st.mtime.toISOString(),
      nameFromHeader: peekName(path)
    })
  }
  return files
}
