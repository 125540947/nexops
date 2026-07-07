import { DbConnection, DbQueryResult } from '../../../shared/types'
import { getClient } from '../ssh/manager'
import * as net from 'net'

// Active tunnel servers: connId -> net.Server
const tunnels = new Map<number, net.Server>()

// ─── SSH Tunnel ───────────────────────────────────────────────────────────────

function openTunnel(
  sshSessionId: string,
  remoteHost: string,
  remotePort: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = getClient(sshSessionId)
    if (!client) return reject(new Error('No active SSH session for tunnel'))

    const server = net.createServer((sock) => {
      client.forwardOut(
        '127.0.0.1', 0,
        remoteHost, remotePort,
        (err, stream) => {
          if (err) { sock.destroy(); return }
          sock.pipe(stream).pipe(sock)
          sock.on('close', () => stream.end())
          stream.on('close', () => sock.destroy())
        }
      )
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo
      resolve(addr.port)
    })

    server.on('error', reject)
  })
}

function closeTunnel(connId: number) {
  const srv = tunnels.get(connId)
  if (srv) { srv.close(); tunnels.delete(connId) }
}

// ─── Resolve host/port (with optional tunnel) ────────────────────────────────

async function resolveEndpoint(
  conn: DbConnection,
  sshSessionId?: string
): Promise<{ host: string; port: number; cleanup: () => void }> {
  if (conn.sshHostId && sshSessionId) {
    const localPort = await openTunnel(sshSessionId, conn.host, conn.port)
    return {
      host: '127.0.0.1',
      port: localPort,
      cleanup: () => closeTunnel(conn.id)
    }
  }
  return { host: conn.host, port: conn.port, cleanup: () => {} }
}

// ─── MySQL ────────────────────────────────────────────────────────────────────

async function queryMySQL(
  conn: DbConnection,
  sql: string,
  sshSessionId?: string
): Promise<DbQueryResult> {
  const { createConnection } = await import('mysql2/promise')
  const { host, port, cleanup } = await resolveEndpoint(conn, sshSessionId)

  const start = Date.now()
  let mysqlConn: Awaited<ReturnType<typeof createConnection>> | null = null

  try {
    mysqlConn = await createConnection({
      host,
      port,
      user: conn.username,
      password: conn.password,
      database: conn.database,
      connectTimeout: 10_000
    })

    const [rows, fields] = await mysqlConn.execute(sql)
    const duration = Date.now() - start

    if (Array.isArray(fields) && fields.length > 0) {
      const columns = fields.map((f) => f.name)
      const data = (rows as Record<string, unknown>[]).map((r) =>
        columns.map((c) => r[c] ?? null)
      )
      return { columns, rows: data, rowCount: data.length, duration }
    }

    // INSERT/UPDATE/DELETE
    const result = rows as { affectedRows: number }
    return {
      columns: ['affectedRows'],
      rows: [[result.affectedRows]],
      rowCount: result.affectedRows,
      duration
    }
  } finally {
    mysqlConn?.end()
    cleanup()
  }
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

async function queryPostgres(
  conn: DbConnection,
  sql: string,
  sshSessionId?: string
): Promise<DbQueryResult> {
  const { Client } = await import('pg')
  const { host, port, cleanup } = await resolveEndpoint(conn, sshSessionId)

  const start = Date.now()
  const pgClient = new Client({
    host,
    port,
    user: conn.username,
    password: conn.password,
    database: conn.database || 'postgres',
    connectionTimeoutMillis: 10_000
  })

  try {
    await pgClient.connect()
    const result = await pgClient.query(sql)
    const duration = Date.now() - start

    if (result.fields && result.fields.length > 0) {
      const columns = result.fields.map((f) => f.name)
      const rows = result.rows.map((r) => columns.map((c) => r[c] ?? null))
      return { columns, rows, rowCount: result.rowCount ?? rows.length, duration }
    }

    return {
      columns: ['rowCount'],
      rows: [[result.rowCount ?? 0]],
      rowCount: result.rowCount ?? 0,
      duration
    }
  } finally {
    await pgClient.end()
    cleanup()
  }
}

// ─── Redis ────────────────────────────────────────────────────────────────────

async function queryRedis(
  conn: DbConnection,
  cmd: string,
  sshSessionId?: string
): Promise<DbQueryResult> {
  const Redis = (await import('ioredis')).default
  const { host, port, cleanup } = await resolveEndpoint(conn, sshSessionId)

  const start = Date.now()
  const redis = new Redis({
    host,
    port,
    password: conn.password || undefined,
    connectTimeout: 10_000,
    lazyConnect: true
  })

  try {
    await redis.connect()

    const parts = cmd.trim().split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    const result = await (redis as unknown as Record<string, (...a: string[]) => Promise<unknown>>)[command](...args)
    const duration = Date.now() - start

    if (result === null) {
      return { columns: ['result'], rows: [['(nil)']], rowCount: 1, duration }
    }

    if (Array.isArray(result)) {
      return {
        columns: ['index', 'value'],
        rows: result.map((v, i) => [i, String(v ?? '(nil)')]),
        rowCount: result.length,
        duration
      }
    }

    return {
      columns: ['result'],
      rows: [[String(result)]],
      rowCount: 1,
      duration
    }
  } finally {
    redis.disconnect()
    cleanup()
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export async function executeDbQuery(
  conn: DbConnection,
  sql: string,
  sshSessionId?: string
): Promise<DbQueryResult> {
  try {
    switch (conn.type) {
      case 'mysql':      return await queryMySQL(conn, sql, sshSessionId)
      case 'postgresql': return await queryPostgres(conn, sql, sshSessionId)
      case 'redis':      return await queryRedis(conn, sql, sshSessionId)
      default:           throw new Error(`Unsupported database type: ${conn.type}`)
    }
  } catch (err) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      duration: 0,
      error: String(err)
    }
  }
}

export async function testDbConnection(
  conn: DbConnection,
  sshSessionId?: string
): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const testSql: Record<string, string> = {
    mysql: 'SELECT 1 AS ok',
    postgresql: 'SELECT 1 AS ok',
    redis: 'PING'
  }
  const result = await executeDbQuery(conn, testSql[conn.type] || 'SELECT 1', sshSessionId)
  if (result.error) return { ok: false, error: result.error }
  return { ok: true, latency: result.duration }
}
