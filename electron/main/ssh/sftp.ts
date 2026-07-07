import { SFTPWrapper } from 'ssh2'
import { SftpEntry } from '../../../shared/types'
import { getClient } from './manager'

const sftpSessions = new Map<string, SFTPWrapper>()

export function openSftp(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = getClient(sessionId)
    if (!client) return reject(new Error('No SSH connection for session: ' + sessionId))

    client.sftp((err, sftp) => {
      if (err) return reject(err)
      sftpSessions.set(sessionId, sftp)
      resolve()
    })
  })
}

export function listDirectory(sessionId: string, path: string): Promise<SftpEntry[]> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))

    sftp.readdir(path, (err, list) => {
      if (err) return reject(err)

      const entries: SftpEntry[] = list.map((item) => ({
        name: item.filename,
        path: path.endsWith('/') ? path + item.filename : path + '/' + item.filename,
        type: item.attrs.isDirectory()
          ? 'directory'
          : item.attrs.isSymbolicLink()
            ? 'symlink'
            : 'file',
        size: item.attrs.size,
        modifyTime: item.attrs.mtime * 1000,
        permissions: item.attrs.mode
      }))

      // Directories first, then files, alphabetical
      entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

      resolve(entries)
    })
  })
}

export function uploadFile(
  sessionId: string,
  localPath: string,
  remotePath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))

    sftp.fastPut(localPath, remotePath, {
      step: (transferred, _chunk, total) => {
        onProgress?.(transferred, total)
      }
    }, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export function downloadFile(
  sessionId: string,
  remotePath: string,
  localPath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))

    sftp.fastGet(remotePath, localPath, {
      step: (transferred, _chunk, total) => {
        onProgress?.(transferred, total)
      }
    }, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export function makeDirectory(sessionId: string, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))
    sftp.mkdir(path, (err) => (err ? reject(err) : resolve()))
  })
}

export function deleteEntry(sessionId: string, path: string, isDir: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))

    if (isDir) {
      sftp.rmdir(path, (err) => (err ? reject(err) : resolve()))
    } else {
      sftp.unlink(path, (err) => (err ? reject(err) : resolve()))
    }
  })
}

export function renameEntry(sessionId: string, oldPath: string, newPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))
    sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()))
  })
}

export function getStat(sessionId: string, path: string): Promise<{ size: number; mtime: number }> {
  return new Promise((resolve, reject) => {
    const sftp = sftpSessions.get(sessionId)
    if (!sftp) return reject(new Error('No SFTP session'))
    sftp.stat(path, (err, stats) => {
      if (err) return reject(err)
      resolve({ size: stats.size, mtime: stats.mtime * 1000 })
    })
  })
}

export function closeSftp(sessionId: string) {
  const sftp = sftpSessions.get(sessionId)
  if (sftp) {
    sftp.end()
    sftpSessions.delete(sessionId)
  }
}
