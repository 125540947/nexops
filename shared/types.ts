// ─── Host & Group ────────────────────────────────────────────────────────────

export type AuthType = 'password' | 'key' | 'agent'

export interface Host {
  id: number
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password?: string
  keyPath?: string
  passphrase?: string
  groupId?: number
  notes?: string
  tags?: string
  jumpHostId?: number
  createdAt: number
  updatedAt: number
}

export interface HostGroup {
  id: number
  name: string
  parentId?: number
  color?: string
  icon?: string
  createdAt: number
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type SessionType = 'terminal' | 'sftp'
export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface Session {
  id: string
  hostId: number
  type: SessionType
  status: SessionStatus
  startedAt: number
  endedAt?: number
}

// ─── SFTP ────────────────────────────────────────────────────────────────────

export interface SftpEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  modifyTime: number
  permissions: number
}

// ─── Batch Ops ───────────────────────────────────────────────────────────────

export type BatchTaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'stopped'

export interface BatchHostResult {
  hostId: number
  hostName: string
  hostAddr: string
  status: BatchTaskStatus
  output: string
  exitCode?: number
  startedAt?: number
  endedAt?: number
  error?: string
}

export interface BatchJob {
  id: string
  command: string
  hostIds: number[]
  createdAt: number
  results: BatchHostResult[]
}

// ─── Database ────────────────────────────────────────────────────────────────

export type DbType = 'mysql' | 'postgresql' | 'redis'

export interface DbConnection {
  id: number
  name: string
  type: DbType
  host: string
  port: number
  username?: string
  password?: string
  database?: string
  sshHostId?: number   // 通过 SSH 隧道连接
  createdAt: number
}

export interface CreateDbConnectionInput {
  name: string
  type: DbType
  host: string
  port: number
  username?: string
  password?: string
  database?: string
  sshHostId?: number
}

export interface DbQueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  duration: number
  error?: string
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export type AiProvider = 'ollama' | 'openai'

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiSettings {
  provider: AiProvider
  ollamaUrl: string
  ollamaModel: string
  openaiBaseUrl: string
  openaiKey: string
  openaiModel: string
  systemPrompt: string
}

// ─── IPC API types ────────────────────────────────────────────────────────────

export interface CreateHostInput {
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password?: string
  keyPath?: string
  passphrase?: string
  groupId?: number
  notes?: string
  tags?: string
  jumpHostId?: number
}

export interface UpdateHostInput extends Partial<CreateHostInput> {
  id: number
}

export interface CreateGroupInput {
  name: string
  parentId?: number
  color?: string
  icon?: string
}

export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}
