import { Client } from 'basic-ftp'
import { utimesSync } from 'fs'
import { join } from 'path'
import type { DownloadOutcome, RemoteFile, TlsMode, TransferProgress } from '../shared/types'
import { STAT_FILENAME_RE } from '../shared/types'
import type { ConnectPayload } from '../shared/api'

const TIMEOUT_MS = 15000

interface Session {
  client: Client
  args: ConnectPayload
  tlsMode: TlsMode
}

let session: Session | null = null
/** client of an in-flight open(); doubles as the cancel token — disconnect() nulls it */
let pending: Client | null = null
let queue: Promise<unknown> = Promise.resolve()

export class NotConnectedError extends Error {
  constructor() {
    super('Not connected to a Miniserver')
  }
}

function isAuthError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 530
}

async function open(args: ConnectPayload): Promise<Session> {
  const attempts: TlsMode[] =
    args.tls === 'auto' ? ['ftps', 'plain'] : [args.tls === 'ftps' ? 'ftps' : 'plain']
  let lastErr: unknown
  for (const mode of attempts) {
    const client = new Client(TIMEOUT_MS)
    pending = client
    try {
      await client.access({
        host: args.host,
        port: args.port,
        user: args.user,
        password: args.password,
        secure: mode === 'ftps',
        // Miniserver TLS certs are self-signed / hostname-mismatched on the LAN
        secureOptions: { rejectUnauthorized: false }
      })
      pending = null
      return { client, args, tlsMode: mode }
    } catch (e) {
      client.close()
      if (pending !== client) throw e // cancelled from outside — don't try the next mode
      pending = null
      lastErr = e
      if (isAuthError(e)) throw e // wrong credentials — retrying without TLS won't help
    }
  }
  throw lastErr
}

export async function connect(args: ConnectPayload): Promise<TlsMode> {
  session?.client.close()
  session = null
  session = await open(args)
  return session.tlsMode
}

export function disconnect(): null {
  pending?.close() // aborts a connect attempt still in flight
  pending = null
  session?.client.close()
  session = null
  return null
}

/** Serialize all FTP work (the control connection is single-channel) and retry once after reconnect. */
function run<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const p = queue.then(async () => {
    if (!session) throw new NotConnectedError()
    try {
      return await fn(session.client)
    } catch (e) {
      if (!session.client.closed) throw e
      session = await open(session.args)
      return await fn(session.client)
    }
  })
  queue = p.catch(() => {})
  return p
}

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
}

/**
 * The Miniserver LIST output has UTC dates without a year ("Nov  8 21:01") or
 * with one for older files ("Nov 08 2023"). Yearless dates are assumed to be
 * this year unless that would put them in the future (LoxStatEdit heuristic).
 */
export function parseListDate(raw: string | undefined, now = new Date()): string | null {
  if (!raw) return null
  const m = /^([A-Za-z]{3})\s+(\d{1,2})\s+(?:(\d{4})|(\d{1,2}):(\d{2}))$/.exec(raw.trim())
  if (!m) return null
  const mon = MONTHS[m[1]]
  if (mon === undefined) return null
  const day = Number(m[2])
  if (m[3]) return new Date(Date.UTC(Number(m[3]), mon, day)).toISOString()
  let year = now.getUTCFullYear()
  const ts = Date.UTC(year, mon, day, Number(m[4]), Number(m[5]))
  if (ts > now.getTime() + 24 * 3600 * 1000) year--
  return new Date(Date.UTC(year, mon, day, Number(m[4]), Number(m[5]))).toISOString()
}

export function listStats(): Promise<RemoteFile[]> {
  return run(async (c) => {
    const infos = await c.list('/stats')
    const files: RemoteFile[] = []
    for (const info of infos) {
      if (!info.isFile) continue
      const m = STAT_FILENAME_RE.exec(info.name)
      if (!m) continue
      files.push({
        name: info.name,
        uuid: m[1],
        suffix: m[2] ? Number(m[2]) : null,
        yyyymm: m[3] + m[4],
        size: info.size,
        modifiedAt: info.modifiedAt?.toISOString() ?? parseListDate(info.rawModifiedAt)
      })
    }
    return files
  })
}

export function activeHost(): string {
  if (!session) throw new NotConnectedError()
  return session.args.host
}

export interface TransferFile {
  name: string
  size: number
  modifiedAt: string | null
}

export function download(
  files: TransferFile[],
  destDir: string,
  onProgress: (p: TransferProgress) => void
): Promise<DownloadOutcome> {
  return run(async (c) => {
    const outcome: DownloadOutcome = { done: [], failed: [] }
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      c.trackProgress((info) =>
        onProgress({
          file: f.name,
          index: i,
          total: files.length,
          bytes: info.bytes,
          bytesTotal: f.size
        })
      )
      try {
        const dest = join(destDir, f.name)
        await c.downloadTo(dest, `/stats/${f.name}`)
        if (f.modifiedAt) {
          const d = new Date(f.modifiedAt)
          utimesSync(dest, d, d)
        }
        outcome.done.push(f.name)
      } catch (e) {
        // dead control connection kills the whole batch; per-file errors don't
        if (c.closed) throw e
        outcome.failed.push({ name: f.name, message: e instanceof Error ? e.message : String(e) })
      } finally {
        c.trackProgress()
      }
    }
    return outcome
  })
}

export function upload(
  files: TransferFile[],
  srcDir: string,
  onProgress: (p: TransferProgress) => void
): Promise<string[]> {
  return run(async (c) => {
    const done: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      c.trackProgress((info) =>
        onProgress({
          file: f.name,
          index: i,
          total: files.length,
          bytes: info.bytes,
          bytesTotal: f.size
        })
      )
      try {
        await c.uploadFrom(join(srcDir, f.name), `/stats/${f.name}`)
      } finally {
        c.trackProgress()
      }
      done.push(f.name)
    }
    return done
  })
}

export function remove(names: string[]): Promise<null> {
  return run(async (c) => {
    for (const name of names) await c.remove(`/stats/${name}`)
    return null
  })
}
