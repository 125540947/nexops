import { Client } from 'ssh2'
import { BrowserWindow } from 'electron'
import { Host, BatchHostResult, BatchTaskStatus } from '../../../shared/types'

// jobId -> Map<hostId -> Client>
const activeJobs = new Map<string, Map<number, Client>>()

function buildConnectConfig(host: Host): Parameters<Client['connect']>[0] {
  const base = {
    host: host.host,
    port: host.port,
    username: host.username,
    readyTimeout: 15000,
    keepaliveInterval: 0
  }
  if (host.authType === 'password') {
    return { ...base, password: host.password }
  }
  if (host.authType === 'key') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    return {
      ...base,
      privateKey: fs.readFileSync(host.keyPath!),
      ...(host.passphrase ? { passphrase: host.passphrase } : {})
    }
  }
  return { ...base, agent: process.env.SSH_AUTH_SOCK }
}

function emit(win: BrowserWindow, jobId: string, hostId: number, event: string, payload: unknown) {
  if (!win.isDestroyed()) {
    win.webContents.send(`batch:${event}:${jobId}:${hostId}`, payload)
  }
}

export function runBatchJob(
  jobId: string,
  command: string,
  hosts: Host[],
  win: BrowserWindow,
  timeoutMs = 30_000
): void {
  const clients = new Map<number, Client>()
  activeJobs.set(jobId, clients)

  for (const host of hosts) {
    const client = new Client()
    clients.set(host.id, client)

    const startedAt = Date.now()
    emit(win, jobId, host.id, 'start', { startedAt })

    let timer: ReturnType<typeof setTimeout> | null = null

    client.on('ready', () => {
      client.exec(command, { pty: false }, (err, stream) => {
        if (err) {
          emit(win, jobId, host.id, 'error', { error: err.message, endedAt: Date.now() })
          client.end()
          return
        }

        timer = setTimeout(() => {
          emit(win, jobId, host.id, 'error', {
            error: `Timeout after ${timeoutMs / 1000}s`,
            endedAt: Date.now()
          })
          stream.destroy()
          client.end()
        }, timeoutMs)

        stream.on('data', (data: Buffer) => {
          emit(win, jobId, host.id, 'data', data.toString())
        })

        stream.stderr.on('data', (data: Buffer) => {
          emit(win, jobId, host.id, 'stderr', data.toString())
        })

        stream.on('close', (code: number) => {
          if (timer) clearTimeout(timer)
          emit(win, jobId, host.id, 'done', { exitCode: code, endedAt: Date.now() })
          client.end()
        })
      })
    })

    client.on('error', (err) => {
      if (timer) clearTimeout(timer)
      emit(win, jobId, host.id, 'error', { error: err.message, endedAt: Date.now() })
    })

    client.on('close', () => {
      clients.delete(host.id)
      if (clients.size === 0) {
        activeJobs.delete(jobId)
        if (!win.isDestroyed()) {
          win.webContents.send(`batch:finished:${jobId}`)
        }
      }
    })

    try {
      client.connect(buildConnectConfig(host))
    } catch (e) {
      emit(win, jobId, host.id, 'error', { error: String(e), endedAt: Date.now() })
    }
  }
}

export function stopBatchJob(jobId: string, hostId?: number): void {
  const clients = activeJobs.get(jobId)
  if (!clients) return

  if (hostId !== undefined) {
    clients.get(hostId)?.end()
    clients.delete(hostId)
  } else {
    for (const client of clients.values()) client.end()
    activeJobs.delete(jobId)
  }
}

export function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId)
}
