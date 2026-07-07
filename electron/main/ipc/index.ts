import { ipcMain, BrowserWindow, dialog } from 'electron'
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { hosts as hostsTable, groups as groupsTable, snippets as snippetsTable, settings as settingsTable } from '../db/schema'
import { streamChat, abortChat, listOllamaModels } from '../ai'
import type { AiMessage, AiSettings } from '../../../shared/types'
import {
  connectSsh,
  writeToSession,
  resizeSession,
  disconnectSession
} from '../ssh/manager'
import { runBatchJob, stopBatchJob } from '../ssh/batch'
import { executeDbQuery, testDbConnection } from '../db/client'
import { dbConnections as dbTable } from '../db/schema'
import type { CreateDbConnectionInput, DbConnection } from '../../../shared/types'
import {
  openSftp,
  listDirectory,
  uploadFile,
  downloadFile,
  makeDirectory,
  deleteEntry,
  renameEntry,
  closeSftp
} from '../ssh/sftp'
import type { CreateHostInput, UpdateHostInput, CreateGroupInput, Host } from '../../../shared/types'

function ok<T>(data: T) {
  return { ok: true, data }
}

function fail(error: string) {
  return { ok: false, error }
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  // ─── Hosts ────────────────────────────────────────────────────────────────

  ipcMain.handle('hosts:list', async () => {
    try {
      const db = getDb()
      const rows = await db.select().from(hostsTable).all()
      const result = rows.map((r) => ({
        ...r,
        authType: r.authType as Host['authType']
      }))
      return ok(result)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('hosts:create', async (_e, input: CreateHostInput) => {
    try {
      const db = getDb()
      const now = Date.now()
      const result = await db
        .insert(hostsTable)
        .values({
          ...input,
          authType: input.authType,
          createdAt: now,
          updatedAt: now
        })
        .returning()
      return ok(result[0])
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('hosts:update', async (_e, input: UpdateHostInput) => {
    try {
      const db = getDb()
      const { id, ...rest } = input
      const result = await db
        .update(hostsTable)
        .set({ ...rest, updatedAt: Date.now() })
        .where(eq(hostsTable.id, id))
        .returning()
      return ok(result[0])
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('hosts:delete', async (_e, id: number) => {
    try {
      const db = getDb()
      await db.delete(hostsTable).where(eq(hostsTable.id, id))
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  // ─── Groups ───────────────────────────────────────────────────────────────

  ipcMain.handle('groups:list', async () => {
    try {
      const db = getDb()
      const rows = await db.select().from(groupsTable).all()
      return ok(rows)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('groups:create', async (_e, input: CreateGroupInput) => {
    try {
      const db = getDb()
      const result = await db
        .insert(groupsTable)
        .values({ ...input, createdAt: Date.now() })
        .returning()
      return ok(result[0])
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('groups:delete', async (_e, id: number) => {
    try {
      const db = getDb()
      await db.delete(groupsTable).where(eq(groupsTable.id, id))
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  // ─── SSH Sessions ─────────────────────────────────────────────────────────

  ipcMain.handle('ssh:connect', async (_e, sessionId: string, host: Host) => {
    try {
      const win = getWindow()
      if (!win) return fail('No window')
      await connectSsh(sessionId, host, win)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('ssh:write', (_e, sessionId: string, data: string) => {
    writeToSession(sessionId, data)
  })

  ipcMain.handle('ssh:resize', (_e, sessionId: string, cols: number, rows: number) => {
    resizeSession(sessionId, cols, rows)
  })

  ipcMain.handle('ssh:disconnect', (_e, sessionId: string) => {
    disconnectSession(sessionId)
    closeSftp(sessionId)
    return ok(true)
  })

  // ─── SFTP ─────────────────────────────────────────────────────────────────

  ipcMain.handle('sftp:open', async (_e, sessionId: string) => {
    try {
      await openSftp(sessionId)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:list', async (_e, sessionId: string, path: string) => {
    try {
      const entries = await listDirectory(sessionId, path)
      return ok(entries)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:mkdir', async (_e, sessionId: string, path: string) => {
    try {
      await makeDirectory(sessionId, path)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:delete', async (_e, sessionId: string, path: string, isDir: boolean) => {
    try {
      await deleteEntry(sessionId, path, isDir)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:rename', async (_e, sessionId: string, oldPath: string, newPath: string) => {
    try {
      await renameEntry(sessionId, oldPath, newPath)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:upload', async (_e, sessionId: string, remotePath: string) => {
    try {
      const win = getWindow()
      if (!win) return fail('No window')

      const result = await dialog.showOpenDialog(win, {
        title: 'Select file to upload',
        properties: ['openFile', 'multiSelections']
      })
      if (result.canceled) return ok([])

      const uploads = result.filePaths.map(async (localPath) => {
        const fileName = localPath.split(/[\\/]/).pop()!
        const dest = remotePath.endsWith('/')
          ? remotePath + fileName
          : remotePath + '/' + fileName
        await uploadFile(sessionId, localPath, dest)
        return dest
      })

      const uploaded = await Promise.all(uploads)
      return ok(uploaded)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('sftp:download', async (_e, sessionId: string, remotePath: string) => {
    try {
      const win = getWindow()
      if (!win) return fail('No window')

      const fileName = remotePath.split('/').pop()!
      const result = await dialog.showSaveDialog(win, {
        defaultPath: fileName,
        title: 'Save file'
      })
      if (result.canceled) return ok(null)

      await downloadFile(sessionId, remotePath, result.filePath!)
      return ok(result.filePath)
    } catch (e) {
      return fail(String(e))
    }
  })

  // ─── Snippets ─────────────────────────────────────────────────────────────

  ipcMain.handle('snippets:list', async () => {
    try {
      const db = getDb()
      const rows = await db.select().from(snippetsTable).all()
      return ok(rows)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('snippets:create', async (_e, input: { name: string; command: string; description?: string }) => {
    try {
      const db = getDb()
      const result = await db
        .insert(snippetsTable)
        .values({ ...input, createdAt: Date.now() })
        .returning()
      return ok(result[0])
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('snippets:delete', async (_e, id: number) => {
    try {
      const db = getDb()
      await db.delete(snippetsTable).where(eq(snippetsTable.id, id))
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  // ─── Batch Ops ────────────────────────────────────────────────────────────

  ipcMain.handle('batch:run', async (_e, jobId: string, command: string, hostIds: number[]) => {
    try {
      const win = getWindow()
      if (!win) return fail('No window')
      const db = getDb()
      const rows = await db.select().from(hostsTable).where(inArray(hostsTable.id, hostIds)).all()
      const hosts = rows.map((r) => ({ ...r, authType: r.authType as import('../../../shared/types').Host['authType'] }))
      runBatchJob(jobId, command, hosts, win)
      return ok(true)
    } catch (e) {
      return fail(String(e))
    }
  })

  ipcMain.handle('batch:stop', (_e, jobId: string, hostId?: number) => {
    stopBatchJob(jobId, hostId)
    return ok(true)
  })

  // ─── Database ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:list', async () => {
    try {
      const db = getDb()
      const rows = await db.select().from(dbTable).all()
      return ok(rows)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('db:create', async (_e, input: CreateDbConnectionInput) => {
    try {
      const db = getDb()
      const result = await db.insert(dbTable).values({ ...input, createdAt: Date.now() }).returning()
      return ok(result[0])
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('db:delete', async (_e, id: number) => {
    try {
      const db = getDb()
      await db.delete(dbTable).where(eq(dbTable.id, id))
      return ok(true)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('db:test', async (_e, conn: DbConnection, sshSessionId?: string) => {
    try {
      const result = await testDbConnection(conn, sshSessionId)
      return ok(result)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('db:query', async (_e, conn: DbConnection, sql: string, sshSessionId?: string) => {
    try {
      const result = await executeDbQuery(conn, sql, sshSessionId)
      return ok(result)
    } catch (e) { return fail(String(e)) }
  })

  // ─── AI ───────────────────────────────────────────────────────────────────

  const DEFAULT_AI_SETTINGS: AiSettings = {
    provider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    systemPrompt: 'You are an expert DevOps/SRE assistant. Help with Linux, SSH, databases, shell scripting, and infrastructure. Be concise and practical. Use code blocks for commands and scripts.'
  }

  ipcMain.handle('ai:settings:get', async () => {
    try {
      const db = getDb()
      const rows = await db.select().from(settingsTable).all()
      const map: Record<string, string> = {}
      for (const r of rows) {
        if (r.key.startsWith('ai.')) map[r.key.slice(3)] = r.value
      }
      const s: AiSettings = {
        provider: (map.provider as AiSettings['provider']) || DEFAULT_AI_SETTINGS.provider,
        ollamaUrl: map.ollamaUrl || DEFAULT_AI_SETTINGS.ollamaUrl,
        ollamaModel: map.ollamaModel || DEFAULT_AI_SETTINGS.ollamaModel,
        openaiBaseUrl: map.openaiBaseUrl || DEFAULT_AI_SETTINGS.openaiBaseUrl,
        openaiKey: map.openaiKey || DEFAULT_AI_SETTINGS.openaiKey,
        openaiModel: map.openaiModel || DEFAULT_AI_SETTINGS.openaiModel,
        systemPrompt: map.systemPrompt !== undefined ? map.systemPrompt : DEFAULT_AI_SETTINGS.systemPrompt
      }
      return ok(s)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('ai:settings:save', async (_e, s: AiSettings) => {
    try {
      const db = getDb()
      for (const [k, v] of Object.entries(s)) {
        await db
          .insert(settingsTable)
          .values({ key: `ai.${k}`, value: String(v) })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(v) } })
      }
      return ok(true)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('ai:models', async (_e, ollamaUrl: string) => {
    const models = await listOllamaModels(ollamaUrl)
    return ok(models)
  })

  ipcMain.handle('ai:chat', async (_e, chatId: string, messages: AiMessage[], settings: AiSettings) => {
    try {
      const win = getWindow()
      if (!win) return fail('No window')

      streamChat(
        chatId,
        messages,
        settings,
        (text) => win.webContents.send(`ai:chunk:${chatId}`, text),
        () => win.webContents.send(`ai:done:${chatId}`),
        (msg) => win.webContents.send(`ai:error:${chatId}`, msg)
      )

      return ok(true)
    } catch (e) { return fail(String(e)) }
  })

  ipcMain.handle('ai:abort', (_e, chatId: string) => {
    abortChat(chatId)
    return ok(true)
  })

  // ─── Dialog ───────────────────────────────────────────────────────────────

  ipcMain.handle('dialog:open-file', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Select SSH Key',
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
