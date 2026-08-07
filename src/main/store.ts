import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ConnMeta } from '../shared/types'

// ponytail: plain JSON in userData instead of electron-store — same job, zero deps.
interface StoreShape {
  connections: ConnMeta[]
  /** base64 of safeStorage-encrypted passwords, keyed by connection id */
  secrets: Record<string, string>
}

const storeFile = (): string => join(app.getPath('userData'), 'connections.json')

function load(): StoreShape {
  try {
    return JSON.parse(readFileSync(storeFile(), 'utf8'))
  } catch {
    return { connections: [], secrets: {} }
  }
}

function persist(s: StoreShape): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(storeFile(), JSON.stringify(s, null, 2))
}

export function listConnections(): ConnMeta[] {
  return load().connections
}

export function saveConnection(meta: ConnMeta, password: string): void {
  const s = load()
  const idx = s.connections.findIndex((c) => c.id === meta.id)
  if (idx >= 0) s.connections[idx] = meta
  else s.connections.push(meta)
  // No OS keychain available → store no secret at all; user re-enters the password.
  if (safeStorage.isEncryptionAvailable()) {
    s.secrets[meta.id] = safeStorage.encryptString(password).toString('base64')
  }
  persist(s)
}

export function deleteConnection(id: string): void {
  const s = load()
  s.connections = s.connections.filter((c) => c.id !== id)
  delete s.secrets[id]
  persist(s)
}

export function getConnection(id: string): ConnMeta | null {
  return load().connections.find((c) => c.id === id) ?? null
}

export function getPassword(id: string): string | null {
  const b64 = load().secrets[id]
  if (!b64 || !safeStorage.isEncryptionAvailable()) return null
  return safeStorage.decryptString(Buffer.from(b64, 'base64'))
}
