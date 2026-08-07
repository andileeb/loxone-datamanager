import { dialog, ipcMain, shell } from 'electron'
import { FTPError } from 'basic-ftp'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { zipSync, type Zippable } from 'fflate'
import * as ftp from './ftp'
import * as store from './store'
import * as cache from './cache'
import { parseStatFile, serializeStatFile, validateRecords, type ParsedStatFile } from './statfile'
import { loxToDisplay } from '../shared/time'
import type { ApiError, ConnMeta, IpcResult, StatFileData, StatRecord } from '../shared/types'
import type { ConnectPayload, TransferFilePayload } from '../shared/api'

class CodedError extends Error {
  constructor(
    public apiCode: ApiError['code'],
    message: string
  ) {
    super(message)
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof CodedError) return { code: e.apiCode, message: e.message }
  if (e instanceof ftp.NotConnectedError) return { code: 'FTP_NOT_CONNECTED', message: e.message }
  if (e instanceof FTPError) {
    if (e.code === 530)
      return { code: 'FTP_AUTH_FAILED', message: 'Login failed — check user and password' }
    return { code: 'UNKNOWN', message: e.message }
  }
  const msg = e instanceof Error ? e.message : String(e)
  const sysCode = (e as NodeJS.ErrnoException)?.code
  if (sysCode === 'ECONNREFUSED' || sysCode === 'EHOSTUNREACH' || sysCode === 'ENOTFOUND') {
    return { code: 'FTP_REFUSED', message: msg }
  }
  if (/timeout/i.test(msg)) return { code: 'FTP_TIMEOUT', message: msg }
  return { code: 'UNKNOWN', message: msg }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => unknown

function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e) {
      return { ok: false, error: toApiError(e) }
    }
  })
}

/** like handle(), but fn receives the ipc event first (for progress events) */
function handleE(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(event, ...args) }
    } catch (e) {
      return { ok: false, error: toApiError(e) }
    }
  })
}

/** parsed files kept per session so serialization can re-emit the original header bytes */
const parsedFiles = new Map<string, ParsedStatFile>()

function loadParsed(name: string): ParsedStatFile {
  const path = cache.cachePath(ftp.activeHost(), name)
  let parsed: ParsedStatFile
  try {
    parsed = parseStatFile(readFileSync(path), name)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CodedError('IO_ERROR', `${name} is not downloaded yet`)
    }
    throw new CodedError('PARSE_ERROR', e instanceof Error ? e.message : String(e))
  }
  parsedFiles.set(name, parsed)
  return parsed
}

function toStatFileData(p: ParsedStatFile): StatFileData {
  return {
    fileName: p.fileName,
    nameFromHeader: p.nameFromHeader,
    valueCount: p.valueCount,
    stride: p.stride,
    records: p.records,
    problems: p.problems
  }
}

export function registerIpc(): void {
  handle('ftp:connect', (args: ConnectPayload) => ftp.connect(args))
  handle('ftp:connectSaved', (id: string) => {
    const meta = store.getConnection(id)
    if (!meta) throw new CodedError('UNKNOWN', 'Saved connection not found')
    const password = store.getPassword(id)
    if (password === null) {
      throw new CodedError('NO_PASSWORD', 'No stored password — enter it manually')
    }
    return ftp.connect({ ...meta, password })
  })
  handle('ftp:disconnect', () => {
    parsedFiles.clear()
    return ftp.disconnect()
  })
  handle('ftp:listStats', () => ftp.listStats())
  handleE('ftp:download', (event, files: TransferFilePayload[]) =>
    ftp.download(files, cache.cacheDir(ftp.activeHost()), (p) =>
      event.sender.send('transfer:progress', p)
    )
  )
  handleE('ftp:backupZip', async (event) => {
    const host = ftp.activeHost()
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `loxone-stats-${host}-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return null
    // download fresh into a temp dir so the backup reflects server state, not local edits
    const files = await ftp.listStats()
    const tmp = mkdtempSync(join(tmpdir(), 'loxone-backup-'))
    try {
      const outcome = await ftp.download(files, tmp, (p) =>
        event.sender.send('transfer:progress', p)
      )
      if (outcome.failed.length) {
        // an incomplete backup silently masquerading as complete is worse than no backup
        const names = outcome.failed.map((f) => f.name)
        throw new CodedError(
          'IO_ERROR',
          `Backup aborted — ${names.length} file(s) failed to download: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''}`
        )
      }
      const entries: Zippable = {}
      for (const f of files) {
        entries[f.name] = [
          readFileSync(join(tmp, f.name)),
          f.modifiedAt ? { mtime: new Date(f.modifiedAt) } : {}
        ]
      }
      // ponytail: zipSync blocks main for a few seconds on huge archives; fflate's async zip() if it hurts
      writeFileSync(filePath, zipSync(entries))
      return filePath
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  handle('connections:list', () => store.listConnections())
  handle('connections:save', (meta: ConnMeta, password: string) => {
    store.saveConnection(meta, password)
    return null
  })
  handle('connections:remove', (id: string) => {
    store.deleteConnection(id)
    return null
  })

  handleE('ftp:upload', (event, names: string[]) => {
    const host = ftp.activeHost()
    const dir = cache.cacheDir(host)
    const files = names.map((name) => {
      const path = cache.cachePath(host, name)
      return { name, size: statSync(path).size, modifiedAt: null }
    })
    return ftp.upload(files, dir, (p) => event.sender.send('transfer:progress', p))
  })
  handle('ftp:delete', (names: string[]) => {
    for (const name of names) {
      if (!/^[0-9a-f-]+(_[1-9])?\.\d{6}$/.test(name)) throw new CodedError('UNKNOWN', 'Bad name')
    }
    return ftp.remove(names)
  })

  handle('cache:list', () => cache.listCache(ftp.activeHost()))
  handle('cache:openFolder', () => {
    shell.openPath(cache.cacheDir(ftp.activeHost()))
    return null
  })

  handle('stat:parse', (name: string) => toStatFileData(loadParsed(name)))
  handle('stat:validate', (name: string, records: StatRecord[]) => {
    const parsed = parsedFiles.get(name) ?? loadParsed(name)
    const yyyymm = name.slice(-6)
    return validateRecords(records, yyyymm, parsed.valueCount)
  })
  handle('stat:serialize', (name: string, records: StatRecord[]) => {
    const parsed = parsedFiles.get(name) ?? loadParsed(name)
    const buf = serializeStatFile(parsed, records)
    writeFileSync(cache.cachePath(ftp.activeHost(), name), buf)
    parsed.records = records
    parsed.problems = validateRecords(records, name.slice(-6), parsed.valueCount)
    return parsed.problems
  })
  handle('stat:exportCsv', async (name: string) => {
    const parsed = parsedFiles.get(name) ?? loadParsed(name)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${name}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    const header = [
      'Timestamp',
      ...Array.from({ length: parsed.valueCount }, (_, i) => `Value ${i + 1}`)
    ].join(';')
    const lines = parsed.records.map((r) =>
      [loxToDisplay(r.ts), ...r.values.map((v) => String(v))].join(';')
    )
    writeFileSync(filePath, [header, ...lines].join('\n') + '\n')
    return filePath
  })
}
