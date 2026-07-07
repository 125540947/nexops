import { Client, ClientChannel } from 'ssh2'
import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { Host } from '../../../shared/types'

interface SshSession {
  client: Client
  shell?: ClientChannel
  sessionId: string
  hostId: number
}

const sessions = new Map<string, SshSession>()

function getConnectConfig(host: Host) {
  const config: Record<string, unknown> = {
    host: host.host,
    port: host.port,
    username: host.username,
    readyTimeout: 20000,
    keepaliveInterval: 30000
  }

  if (host.authType === 'password') {
    config.password = host.password
  } else if (host.authType === 'key') {
    const fs = require('fs')
    config.privateKey = fs.readFileSync(host.keyPath!)
    if (host.passphrase) config.passphrase = host.passphrase
  } else if (host.authType === 'agent') {
    config.agent = process.env.SSH_AUTH_SOCK
  }

  return config
}

export function connectSsh(
  sessionId: string,
  host: Host,
  win: BrowserWindow
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    client.on('ready', () => {
      client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
        if (err) {
          client.end()
          return reject(err)
        }

        sessions.set(sessionId, { client, shell: stream, sessionId, hostId: host.id })

        stream.on('data', (data: Buffer) => {
          win.webContents.send(`session:data:${sessionId}`, data.toString())
        })

        stream.stderr.on('data', (data: Buffer) => {
          win.webContents.send(`session:data:${sessionId}`, data.toString())
        })

        stream.on('close', () => {
          sessions.delete(sessionId)
          win.webContents.send(`session:closed:${sessionId}`)
        })

        resolve()
      })
    })

    client.on('error', (err) => {
      sessions.delete(sessionId)
      win.webContents.send(`session:error:${sessionId}`, err.message)
      reject(err)
    })

    client.on('close', () => {
      sessions.delete(sessionId)
      win.webContents.send(`session:closed:${sessionId}`)
    })

    try {
      client.connect(getConnectConfig(host) as Parameters<Client['connect']>[0])
    } catch (err) {
      reject(err)
    }
  })
}

export function writeToSession(sessionId: string, data: string) {
  const session = sessions.get(sessionId)
  if (session?.shell) {
    session.shell.write(data)
  }
}

export function resizeSession(sessionId: string, cols: number, rows: number) {
  const session = sessions.get(sessionId)
  if (session?.shell) {
    session.shell.setWindow(rows, cols, 0, 0)
  }
}

export function disconnectSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session) {
    session.shell?.end()
    session.client.end()
    sessions.delete(sessionId)
  }
}

export function getClient(sessionId: string): Client | undefined {
  return sessions.get(sessionId)?.client
}

export function getActiveSessions() {
  return Array.from(sessions.keys())
}
