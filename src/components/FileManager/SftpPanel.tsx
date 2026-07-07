import { useState, useEffect, useCallback } from 'react'
import type { SftpEntry } from '../../../shared/types'

interface Props {
  sessionId: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function entryIcon(entry: SftpEntry): string {
  if (entry.type === 'directory') return '📁'
  if (entry.type === 'symlink') return '↗'
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
    py: '🐍', rb: '💎', go: '🐹', rs: '⚙',
    json: '{}', yml: '📋', yaml: '📋', toml: '📋',
    md: '📝', txt: '📝',
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼',
    zip: '📦', tar: '📦', gz: '📦', bz2: '📦',
    sh: '⚡', bash: '⚡',
    conf: '⚙', cfg: '⚙', env: '⚙'
  }
  return map[ext] ?? '📄'
}

export function SftpPanel({ sessionId }: Props) {
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<SftpEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [status, setStatus] = useState('')

  const navigate = useCallback(
    async (target: string) => {
      setLoading(true)
      setError('')
      setSelected(new Set())
      try {
        const result = await window.nexops.sftp.list(sessionId, target)
        if (!result.ok) {
          setError(result.error ?? 'Failed to list directory')
          return
        }
        setPath(target)
        setEntries(result.data ?? [])
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    },
    [sessionId]
  )

  // Initial open SFTP + list root
  useEffect(() => {
    async function init() {
      setLoading(true)
      setStatus('Opening SFTP…')
      const result = await window.nexops.sftp.open(sessionId)
      if (!result.ok) {
        setError(result.error ?? 'Failed to open SFTP')
        setLoading(false)
        return
      }
      setStatus('')
      await navigate('/')
    }
    init()
  }, [sessionId, navigate])

  function goUp() {
    if (path === '/') return
    const parts = path.split('/').filter(Boolean)
    parts.pop()
    navigate('/' + parts.join('/') || '/')
  }

  function toggleSelect(name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function handleUpload() {
    const result = await window.nexops.sftp.upload(sessionId, path)
    if (result.ok && result.data && result.data.length > 0) {
      setStatus(`Uploaded ${result.data.length} file(s)`)
      navigate(path)
    }
  }

  async function handleDownload() {
    const entry = entries.find((e) => selected.has(e.name) && e.type === 'file')
    if (!entry) return
    const result = await window.nexops.sftp.download(sessionId, entry.path)
    if (result.ok && result.data) {
      setStatus(`Downloaded to ${result.data}`)
    }
  }

  async function handleDelete() {
    const toDelete = entries.filter((e) => selected.has(e.name))
    for (const e of toDelete) {
      await window.nexops.sftp.delete(sessionId, e.path, e.type === 'directory')
    }
    setSelected(new Set())
    navigate(path)
  }

  async function handleNewFolder() {
    if (!newFolderName.trim()) return
    const fullPath = path.endsWith('/')
      ? path + newFolderName.trim()
      : path + '/' + newFolderName.trim()
    const result = await window.nexops.sftp.mkdir(sessionId, fullPath)
    if (result.ok) {
      setNewFolderMode(false)
      setNewFolderName('')
      navigate(path)
    } else {
      setError(result.error ?? 'Failed to create folder')
    }
  }

  async function commitRename() {
    if (!renaming || !renameValue.trim()) return
    const dir = renaming.path.split('/').slice(0, -1).join('/')
    const newPath = (dir || '') + '/' + renameValue.trim()
    await window.nexops.sftp.rename(sessionId, renaming.path, newPath)
    setRenaming(null)
    navigate(path)
  }

  const breadcrumbs = path.split('/').filter(Boolean)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <ToolBtn onClick={goUp} title="Go up" disabled={path === '/'}>↑</ToolBtn>
        <ToolBtn onClick={() => navigate(path)} title="Refresh">↻</ToolBtn>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
        <ToolBtn onClick={handleUpload} title="Upload">↑ Upload</ToolBtn>
        <ToolBtn onClick={handleDownload} title="Download" disabled={!selected.size}>
          ↓ Download
        </ToolBtn>
        <ToolBtn onClick={() => setNewFolderMode(true)} title="New folder">+ Folder</ToolBtn>
        <ToolBtn
          onClick={handleDelete}
          title="Delete"
          disabled={!selected.size}
          danger
        >
          Delete
        </ToolBtn>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 ml-3 flex-1 overflow-x-auto text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span
            className="cursor-pointer hover:underline"
            onClick={() => navigate('/')}
          >
            /
          </span>
          {breadcrumbs.map((seg, i) => {
            const target = '/' + breadcrumbs.slice(0, i + 1).join('/')
            return (
              <span key={i} className="flex items-center gap-1">
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => navigate(target)}
                >
                  {seg}
                </span>
              </span>
            )
          })}
        </div>

        {status && (
          <span className="text-xs ml-2" style={{ color: 'var(--success)' }}>
            {status}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-xs" style={{ background: '#2d1a1a', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* New Folder Input */}
      {newFolderMode && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            New folder:
          </span>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewFolder()
              if (e.key === 'Escape') setNewFolderMode(false)
            }}
            className="h-6 rounded px-2 text-xs outline-none flex-1"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent)',
              color: 'var(--text-primary)'
            }}
            placeholder="folder name"
          />
          <button onClick={handleNewFolder} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>
            Create
          </button>
          <button onClick={() => setNewFolderMode(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading…
            </span>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)', width: '40%' }}>
                  Name
                </th>
                <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)', width: '15%' }}>
                  Size
                </th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)', width: '25%' }}>
                  Modified
                </th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)', width: '20%' }}>
                  Permissions
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.name}
                  className="cursor-pointer"
                  style={{
                    background: selected.has(entry.name)
                      ? 'rgba(56, 139, 253, 0.1)'
                      : 'transparent',
                    borderBottom: '1px solid rgba(48, 54, 61, 0.5)'
                  }}
                  onClick={(e) => toggleSelect(entry.name, e)}
                  onDoubleClick={() => {
                    if (entry.type === 'directory') navigate(entry.path)
                  }}
                  onMouseEnter={(e) => {
                    if (!selected.has(entry.name))
                      e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selected.has(entry.name)
                      ? 'rgba(56, 139, 253, 0.1)'
                      : 'transparent'
                  }}
                >
                  <td className="px-3 py-1.5">
                    {renaming?.name === entry.name ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        onBlur={commitRename}
                        className="h-5 rounded px-1 text-xs outline-none"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--accent)',
                          color: 'var(--text-primary)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="flex items-center gap-1.5"
                        onDoubleClick={(e) => {
                          if (entry.type !== 'directory') {
                            e.stopPropagation()
                            setRenaming(entry)
                            setRenameValue(entry.name)
                          }
                        }}
                      >
                        <span>{entryIcon(entry)}</span>
                        <span
                          style={{
                            color: entry.type === 'directory' ? 'var(--accent)' : 'var(--text-primary)'
                          }}
                        >
                          {entry.name}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {entry.type === 'file' ? formatSize(entry.size) : '—'}
                  </td>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {entry.modifyTime ? formatDate(entry.modifyTime) : '—'}
                  </td>
                  <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                    {formatPerms(entry.permissions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center px-3 py-1.5 flex-shrink-0 text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        {entries.length} items
        {selected.size > 0 && (
          <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>
            · {selected.size} selected
          </span>
        )}
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
  danger
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: 'var(--bg-elevated)',
        color: danger ? 'var(--danger)' : 'var(--text-secondary)',
        border: '1px solid var(--border)'
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
    >
      {children}
    </button>
  )
}

function formatPerms(mode: number): string {
  if (!mode) return '—'
  const chars = '---'
  const perms = ['r', 'w', 'x']
  let result = ''
  for (let shift = 6; shift >= 0; shift -= 3) {
    for (let bit = 2; bit >= 0; bit--) {
      result += (mode >> (shift + bit)) & 1 ? perms[2 - bit] : '-'
    }
  }
  return result
}
