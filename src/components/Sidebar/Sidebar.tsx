import { useState, useMemo } from 'react'
import { useAppStore } from '../../stores/app'
import type { Host, HostGroup } from '../../../shared/types'

interface Props {
  onConnect: (host: Host, type: 'terminal' | 'sftp') => void
  onAddHost: () => void
  onOpenBatch: () => void
  onOpenDb: () => void
}

export function Sidebar({ onConnect, onAddHost, onOpenBatch, onOpenDb }: Props) {
  const { hosts, groups, searchQuery, setSearchQuery, removeHost, removeGroup } = useAppStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    host: Host
  } | null>(null)

  const filteredHosts = useMemo(() => {
    if (!searchQuery) return hosts
    const q = searchQuery.toLowerCase()
    return hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.host.toLowerCase().includes(q) ||
        h.username.toLowerCase().includes(q)
    )
  }, [hosts, searchQuery])

  const toggleGroup = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const ungrouped = filteredHosts.filter((h) => !h.groupId)
  const byGroup = groups.map((g) => ({
    group: g,
    hosts: filteredHosts.filter((h) => h.groupId === g.id)
  }))

  function handleContextMenu(e: React.MouseEvent, host: Host) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, host })
  }

  async function handleDelete(host: Host) {
    setContextMenu(null)
    const result = await window.nexops.hosts.delete(host.id)
    if (result.ok) removeHost(host.id)
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: 'var(--bg-surface)' }}
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 titlebar-drag"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-semibold text-xs tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
          NexOps
        </span>
        <button
          onClick={onAddHost}
          title="Add Host"
          className="titlebar-no-drag w-6 h-6 flex items-center justify-center rounded hover:opacity-70 transition-opacity text-lg leading-none"
          style={{ color: 'var(--accent)' }}
        >
          +
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <input
          type="text"
          placeholder="Search hosts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 rounded-md px-2 text-xs outline-none"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      {/* Host List */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Grouped hosts */}
        {byGroup.map(({ group, hosts: ghosts }) => (
          <div key={group.id}>
            <div
              className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:opacity-80"
              onClick={() => toggleGroup(group.id)}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {expandedGroups.has(group.id) ? '▾' : '▸'}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {group.name}
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {ghosts.length}
              </span>
            </div>
            {expandedGroups.has(group.id) &&
              ghosts.map((h) => (
                <HostItem
                  key={h.id}
                  host={h}
                  indent
                  onConnect={onConnect}
                  onContextMenu={handleContextMenu}
                />
              ))}
          </div>
        ))}

        {/* Ungrouped hosts */}
        {ungrouped.map((h) => (
          <HostItem
            key={h.id}
            host={h}
            onConnect={onConnect}
            onContextMenu={handleContextMenu}
          />
        ))}

        {filteredHosts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-2xl opacity-30">⌘</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No results' : 'No hosts yet'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div
        className="flex-shrink-0 px-2 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-1.5">
          <button
            onClick={onOpenBatch}
            className="flex-1 flex items-center gap-1.5 px-2 py-2 rounded-md text-xs transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          >
            <span>⚡</span>
            <span>Batch</span>
          </button>
          <button
            onClick={onOpenDb}
            className="flex-1 flex items-center gap-1.5 px-2 py-2 rounded-md text-xs transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          >
            <span>🗄</span>
            <span>Database</span>
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)'
          }}
        >
          <CtxItem
            label="Open Terminal"
            icon="⌨"
            onClick={() => {
              onConnect(contextMenu.host, 'terminal')
              setContextMenu(null)
            }}
          />
          <CtxItem
            label="Open SFTP"
            icon="📁"
            onClick={() => {
              onConnect(contextMenu.host, 'sftp')
              setContextMenu(null)
            }}
          />
          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
          <CtxItem
            label="Delete"
            icon="🗑"
            danger
            onClick={() => handleDelete(contextMenu.host)}
          />
        </div>
      )}
    </div>
  )
}

function HostItem({
  host,
  indent,
  onConnect,
  onContextMenu
}: {
  host: Host
  indent?: boolean
  onConnect: (h: Host, t: 'terminal' | 'sftp') => void
  onContextMenu: (e: React.MouseEvent, h: Host) => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md mx-1 group"
      style={{ paddingLeft: indent ? '20px' : '8px' }}
      onDoubleClick={() => onConnect(host, 'terminal')}
      onContextMenu={(e) => onContextMenu(e, host)}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: 'var(--text-muted)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
          {host.name}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {host.username}@{host.host}:{host.port}
        </div>
      </div>
      <div className="hidden group-hover:flex items-center gap-0.5">
        <IconBtn title="Terminal" onClick={() => onConnect(host, 'terminal')}>
          ⌨
        </IconBtn>
        <IconBtn title="SFTP" onClick={() => onConnect(host, 'sftp')}>
          ≡
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  title,
  onClick,
  children
}: {
  title: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      className="w-5 h-5 rounded flex items-center justify-center text-xs hover:opacity-70 transition-opacity"
      style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
    >
      {children}
    </button>
  )
}

function CtxItem({
  label,
  icon,
  danger,
  onClick
}: {
  label: string
  icon: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
      style={{ color: danger ? 'var(--danger)' : 'var(--text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}
