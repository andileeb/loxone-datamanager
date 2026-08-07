import type {
  CachedFile,
  ConnMeta,
  DownloadOutcome,
  IpcResult,
  Problem,
  RemoteFile,
  StatFileData,
  StatRecord,
  TlsMode,
  TlsPref,
  TransferProgress
} from './types'

export interface ConnectPayload {
  host: string
  port: number
  user: string
  password: string
  tls: TlsPref
}

export interface TransferFilePayload {
  name: string
  size: number
  modifiedAt: string | null
}

/** Contract between preload (implements) and renderer (consumes as window.api). */
export interface Api {
  ftp: {
    connect(args: ConnectPayload): Promise<IpcResult<TlsMode>>
    connectSaved(id: string): Promise<IpcResult<TlsMode>>
    disconnect(): Promise<IpcResult<null>>
    listStats(): Promise<IpcResult<RemoteFile[]>>
    download(files: TransferFilePayload[]): Promise<IpcResult<DownloadOutcome>>
    upload(names: string[]): Promise<IpcResult<string[]>>
    delete(names: string[]): Promise<IpcResult<null>>
    /** save dialog, then downloads ALL /stats into a zip; resolves with the written path or null when cancelled */
    backupZip(): Promise<IpcResult<string | null>>
  }
  connections: {
    list(): Promise<IpcResult<ConnMeta[]>>
    save(meta: ConnMeta, password: string): Promise<IpcResult<null>>
    remove(id: string): Promise<IpcResult<null>>
  }
  cache: {
    list(): Promise<IpcResult<CachedFile[]>>
    openFolder(): Promise<IpcResult<null>>
  }
  stat: {
    parse(name: string): Promise<IpcResult<StatFileData>>
    validate(name: string, records: StatRecord[]): Promise<IpcResult<Problem[]>>
    /** writes the edited records into the cached file; returns fresh problems */
    serialize(name: string, records: StatRecord[]): Promise<IpcResult<Problem[]>>
    /** opens a save dialog; resolves with the written path or null when cancelled */
    exportCsv(name: string): Promise<IpcResult<string | null>>
  }
  onTransferProgress(cb: (p: TransferProgress) => void): () => void
}
