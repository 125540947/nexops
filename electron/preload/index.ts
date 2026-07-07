import { contextBridge, ipcRenderer } from 'electron'
import type {
  Host,
  HostGroup,
  CreateHostInput,
  UpdateHostInput,
  CreateGroupInput,
  SftpEntry,
  IpcResult,
  DbConnection,
  CreateDbConnectionInput,
  DbQueryResult,
  AiMessage,
  AiSettings
} from '../../shared/types'

const api = {
  // ─── Hosts ──────────────────────────────────────────────────────────────
  hosts: {
    list: (): Promise<IpcResult<Host[]>> => ipcRenderer.invoke('hosts:list'),
    create: (input: CreateHostInput): Promise<IpcResult<Host>> =>
      ipcRenderer.invoke('hosts:create', input),
    update: (input: UpdateHostInput): Promise<IpcResult<Host>> =>
      ipcRenderer.invoke('hosts:update', input),
    delete: (id: number): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('hosts:delete', id)
  },

  // ─── Groups ─────────────────────────────────────────────────────────────
  groups: {
    list: (): Promise<IpcResult<HostGroup[]>> => ipcRenderer.invoke('groups:list'),
    create: (input: CreateGroupInput): Promise<IpcResult<HostGroup>> =>
      ipcRenderer.invoke('groups:create', input),
    delete: (id: number): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('groups:delete', id)
  },

  // ─── SSH ────────────────────────────────────────────────────────────────
  ssh: {
    connect: (sessionId: string, host: Host): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('ssh:connect', sessionId, host),
    write: (sessionId: string, data: string): void =>
      ipcRenderer.invoke('ssh:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),
    disconnect: (sessionId: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('ssh:disconnect', sessionId),
    onData: (sessionId: string, cb: (data: string) => void) => {
      const channel = `session:data:${sessionId}`
      const handler = (_e: Electron.IpcRendererEvent, data: string) => cb(data)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    },
    onClose: (sessionId: string, cb: () => void) => {
      const channel = `session:closed:${sessionId}`
      const handler = () => cb()
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    },
    onError: (sessionId: string, cb: (msg: string) => void) => {
      const channel = `session:error:${sessionId}`
      const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    }
  },

  // ─── SFTP ───────────────────────────────────────────────────────────────
  sftp: {
    open: (sessionId: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('sftp:open', sessionId),
    list: (sessionId: string, path: string): Promise<IpcResult<SftpEntry[]>> =>
      ipcRenderer.invoke('sftp:list', sessionId, path),
    mkdir: (sessionId: string, path: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, path),
    delete: (sessionId: string, path: string, isDir: boolean): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('sftp:delete', sessionId, path, isDir),
    rename: (sessionId: string, oldPath: string, newPath: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
    upload: (sessionId: string, remotePath: string): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke('sftp:upload', sessionId, remotePath),
    download: (sessionId: string, remotePath: string): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke('sftp:download', sessionId, remotePath)
  },

  // ─── Snippets ───────────────────────────────────────────────────────────
  snippets: {
    list: () => ipcRenderer.invoke('snippets:list'),
    create: (input: { name: string; command: string; description?: string }) =>
      ipcRenderer.invoke('snippets:create', input),
    delete: (id: number) => ipcRenderer.invoke('snippets:delete', id)
  },

  // ─── Batch Ops ──────────────────────────────────────────────────────────
  batch: {
    run: (jobId: string, command: string, hostIds: number[]): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('batch:run', jobId, command, hostIds),
    stop: (jobId: string, hostId?: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('batch:stop', jobId, hostId),

    onStart: (jobId: string, hostId: number, cb: (payload: { startedAt: number }) => void) => {
      const ch = `batch:start:${jobId}:${hostId}`
      const h = (_: Electron.IpcRendererEvent, p: { startedAt: number }) => cb(p)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },
    onData: (jobId: string, hostId: number, cb: (data: string) => void) => {
      const ch = `batch:data:${jobId}:${hostId}`
      const h = (_: Electron.IpcRendererEvent, d: string) => cb(d)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },
    onStderr: (jobId: string, hostId: number, cb: (data: string) => void) => {
      const ch = `batch:stderr:${jobId}:${hostId}`
      const h = (_: Electron.IpcRendererEvent, d: string) => cb(d)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },
    onDone: (jobId: string, hostId: number, cb: (payload: { exitCode: number; endedAt: number }) => void) => {
      const ch = `batch:done:${jobId}:${hostId}`
      const h = (_: Electron.IpcRendererEvent, p: { exitCode: number; endedAt: number }) => cb(p)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },
    onError: (jobId: string, hostId: number, cb: (payload: { error: string; endedAt: number }) => void) => {
      const ch = `batch:error:${jobId}:${hostId}`
      const h = (_: Electron.IpcRendererEvent, p: { error: string; endedAt: number }) => cb(p)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },
    onFinished: (jobId: string, cb: () => void) => {
      const ch = `batch:finished:${jobId}`
      const h = () => cb()
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    }
  },

  // ─── Database ───────────────────────────────────────────────────────────
  db: {
    list: (): Promise<IpcResult<DbConnection[]>> =>
      ipcRenderer.invoke('db:list'),
    create: (input: CreateDbConnectionInput): Promise<IpcResult<DbConnection>> =>
      ipcRenderer.invoke('db:create', input),
    delete: (id: number): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('db:delete', id),
    test: (conn: DbConnection, sshSessionId?: string): Promise<IpcResult<{ ok: boolean; latency?: number; error?: string }>> =>
      ipcRenderer.invoke('db:test', conn, sshSessionId),
    query: (conn: DbConnection, sql: string, sshSessionId?: string): Promise<IpcResult<DbQueryResult>> =>
      ipcRenderer.invoke('db:query', conn, sql, sshSessionId)
  },

  // ─── Dialog ─────────────────────────────────────────────────────────────
  dialog: {
    openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-file')
  },

  // ─── Window ──────────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: (cb: (maximized: boolean) => void) => {
      const h = (_: Electron.IpcRendererEvent, v: boolean) => cb(v)
      ipcRenderer.on('window:maximized', h)
      return () => ipcRenderer.removeListener('window:maximized', h)
    }
  },

  // ─── AI ──────────────────────────────────────────────────────────────────
  ai: {
    chat: (chatId: string, messages: AiMessage[], settings: AiSettings): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('ai:chat', chatId, messages, settings),

    abort: (chatId: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('ai:abort', chatId),

    models: (ollamaUrl: string): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke('ai:models', ollamaUrl),

    settings: {
      get: (): Promise<IpcResult<AiSettings>> => ipcRenderer.invoke('ai:settings:get'),
      save: (s: AiSettings): Promise<IpcResult<boolean>> => ipcRenderer.invoke('ai:settings:save', s)
    },

    onChunk: (chatId: string, cb: (text: string) => void) => {
      const ch = `ai:chunk:${chatId}`
      const h = (_: Electron.IpcRendererEvent, text: string) => cb(text)
      ipcRenderer.on(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },

    onDone: (chatId: string, cb: () => void) => {
      const ch = `ai:done:${chatId}`
      const h = () => cb()
      ipcRenderer.once(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    },

    onError: (chatId: string, cb: (msg: string) => void) => {
      const ch = `ai:error:${chatId}`
      const h = (_: Electron.IpcRendererEvent, msg: string) => cb(msg)
      ipcRenderer.once(ch, h)
      return () => ipcRenderer.removeListener(ch, h)
    }
  }
}

contextBridge.exposeInMainWorld('nexops', api)

export type NexOpsApi = typeof api
