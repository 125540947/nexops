import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type Tab } from './stores/app'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TerminalPane } from './components/Terminal/TerminalPane'
import { SftpPanel } from './components/FileManager/SftpPanel'
import { BatchPanel } from './components/BatchOps/BatchPanel'
import { DbPanel } from './components/Database/DbPanel'
import { AddHostModal } from './components/modals/AddHostModal'
import { AddDbModal } from './components/Database/AddDbModal'
import { AiPanel } from './components/AI/AiPanel'
import type { Host } from '../shared/types'
import './styles/global.css'

const BATCH_TAB_ID = '__batch__'

let sessionCounter = 0
function genSessionId() {
  return `session-${Date.now()}-${++sessionCounter}`
}

export default function App() {
  const {
    hosts, groups, dbConnections, tabs, activeTabId,
    setHosts, setGroups, setDbConnections, addHost, addGroup, addDbConnection,
    openTab, closeTab, setActiveTab, updateTabStatus,
    sidebarWidth, setSidebarWidth,
    aiPanelOpen, toggleAiPanel
  } = useAppStore()

  const [showAddHost, setShowAddHost] = useState(false)
  const [showAddDb, setShowAddDb] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Load initial data
  useEffect(() => {
    async function load() {
      const [hostsRes, groupsRes, dbRes] = await Promise.all([
        window.nexops.hosts.list(),
        window.nexops.groups.list(),
        window.nexops.db.list()
      ])
      if (hostsRes.ok && hostsRes.data) setHosts(hostsRes.data)
      if (groupsRes.ok && groupsRes.data) setGroups(groupsRes.data)
      if (dbRes.ok && dbRes.data) setDbConnections(dbRes.data)
    }
    load()
  }, [])

  const openConnection = useCallback(
    async (host: Host, type: 'terminal' | 'sftp') => {
      const sessionId = genSessionId()
      const tab: Tab = {
        id: sessionId,
        hostId: host.id,
        hostName: host.name,
        hostLabel: `${host.username}@${host.host}`,
        type,
        sessionId,
        status: 'connecting'
      }

      openTab(tab)

      // Connect SSH
      const result = await window.nexops.ssh.connect(sessionId, host)
      if (!result.ok) {
        updateTabStatus(sessionId, 'error', result.error)
        return
      }

      updateTabStatus(sessionId, 'connected')

      // Listen for close
      window.nexops.ssh.onClose(sessionId, () => {
        updateTabStatus(sessionId, 'disconnected')
      })

      window.nexops.ssh.onError(sessionId, (msg) => {
        updateTabStatus(sessionId, 'error', msg)
      })
    },
    [openTab, updateTabStatus]
  )

  async function handleCloseTab(tabId: string) {
    if (tabId === BATCH_TAB_ID) {
      closeTab(tabId)
      return
    }
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) await window.nexops.ssh.disconnect(tab.sessionId)
    closeTab(tabId)
  }

  function openDbTab(connId: number) {
    const tabId = `db-${connId}`
    const conn = dbConnections.find((d) => d.id === connId)
    if (!conn) return
    openTab({
      id: tabId,
      hostId: -1,
      hostName: conn.name,
      hostLabel: conn.type,
      type: 'db',
      sessionId: tabId,
      status: 'connected'
    })
  }

  function openBatchTab() {
    const exists = tabs.find((t) => t.id === BATCH_TAB_ID)
    if (exists) {
      setActiveTab(BATCH_TAB_ID)
      return
    }
    openTab({
      id: BATCH_TAB_ID,
      hostId: -1,
      hostName: 'Batch Ops',
      hostLabel: 'Multi-host execution',
      type: 'batch',
      sessionId: BATCH_TAB_ID,
      status: 'connected'
    })
  }

  // Sidebar resize
  function startResize() {
    setResizing(true)
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(400, e.clientX))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{ width: sidebarWidth, borderRight: '1px solid var(--border)' }}
      >
        <Sidebar
          onConnect={openConnection}
          onAddHost={() => setShowAddHost(true)}
          onOpenBatch={openBatchTab}
          onOpenDb={() => setShowAddDb(true)}
        />
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 flex-shrink-0 cursor-col-resize hover:opacity-100 transition-opacity"
        style={{ background: resizing ? 'var(--accent)' : 'transparent' }}
        onMouseDown={startResize}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
        onMouseLeave={(e) => {
          if (!resizing) e.currentTarget.style.background = 'transparent'
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Custom Titlebar + Tabs */}
        <div
          className="flex items-end flex-shrink-0 titlebar-drag"
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            minHeight: 38,
            paddingTop: process.platform === 'darwin' ? 20 : 0
          }}
        >
          {tabs.length === 0 && (
            <div
              className="flex-1 flex items-center justify-center pb-2 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Double-click a host or right-click to connect
            </div>
          )}

          <div className="flex items-end flex-1 overflow-x-auto titlebar-no-drag">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer flex-shrink-0 text-xs border-r transition-colors"
                style={{
                  background: activeTabId === tab.id ? 'var(--bg-base)' : 'transparent',
                  borderColor: 'var(--border)',
                  color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderTop: activeTabId === tab.id
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                  maxWidth: 200
                }}
              >
                <span className="text-xs">
                  {tab.type === 'sftp' ? '≡' : tab.type === 'batch' ? '⚡' : tab.type === 'db' ? '🗄' : '⌨'}
                </span>
                <StatusDot status={tab.status} />
                <span className="truncate" title={tab.hostLabel}>
                  {tab.hostName}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseTab(tab.id)
                  }}
                  className="ml-1 opacity-40 hover:opacity-100 transition-opacity leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* AI toggle */}
          <button
            onClick={toggleAiPanel}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs transition-colors titlebar-no-drag"
            style={{
              background: aiPanelOpen ? 'var(--accent)' : 'transparent',
              color: aiPanelOpen ? '#fff' : 'var(--text-secondary)',
              borderLeft: '1px solid var(--border)',
              borderTop: '2px solid transparent',
              whiteSpace: 'nowrap'
            }}
            title="Toggle AI Assistant"
          >
            🤖 AI
          </button>
        </div>

        {/* Tab Content + AI Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-hidden relative">
            {tabs.length === 0 && (
              <WelcomeScreen onAddHost={() => setShowAddHost(true)} />
            )}

            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
              >
                {tab.status === 'connecting' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-3">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto animate-spin"
                        style={{ borderColor: 'var(--accent)' }}
                      />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Connecting to {tab.hostLabel}…
                      </p>
                    </div>
                  </div>
                )}

                {tab.status === 'error' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2 max-w-md px-6">
                      <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
                        Connection failed
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {tab.errorMsg}
                      </p>
                    </div>
                  </div>
                )}

                {tab.status === 'connected' && tab.type === 'terminal' && (
                  <TerminalPane
                    sessionId={tab.sessionId}
                    isActive={activeTabId === tab.id}
                  />
                )}

                {tab.status === 'connected' && tab.type === 'sftp' && (
                  <SftpPanel sessionId={tab.sessionId} />
                )}

                {tab.type === 'batch' && (
                  <BatchPanel />
                )}

                {tab.type === 'db' && (() => {
                  const connId = Number(tab.id.replace('db-', ''))
                  const conn = dbConnections.find((d) => d.id === connId)
                  return conn ? <DbPanel key={tab.id} conn={conn} /> : null
                })()}
              </div>
            ))}
          </div>

          {/* AI Panel (right drawer) */}
          {aiPanelOpen && (
            <div
              className="flex-shrink-0 flex flex-col"
              style={{ width: 360, borderLeft: '1px solid var(--border)' }}
            >
              <AiPanel onClose={toggleAiPanel} />
            </div>
          )}
        </div>
      </div>

      {/* Add DB Modal */}
      {showAddDb && (
        <AddDbModal
          onClose={() => setShowAddDb(false)}
          onSave={async (input) => {
            const result = await window.nexops.db.create(input)
            if (result.ok && result.data) addDbConnection(result.data)
          }}
        />
      )}

      {/* Add Host Modal */}
      {showAddHost && (
        <AddHostModal
          groups={groups}
          onClose={() => setShowAddHost(false)}
          onSave={async (input) => {
            const result = await window.nexops.hosts.create(input)
            if (result.ok && result.data) addHost(result.data)
          }}
        />
      )}
    </div>
  )
}

function StatusDot({ status }: { status: Tab['status'] }) {
  const color = {
    connecting: 'var(--warning)',
    connected: 'var(--success)',
    disconnected: 'var(--text-muted)',
    error: 'var(--danger)'
  }[status]

  return (
    <div
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  )
}

function WelcomeScreen({ onAddHost }: { onAddHost: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-5xl opacity-20">⌘</div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            NexOps
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Modern SSH workspace for developers and teams
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={onAddHost}
            className="px-4 py-2 rounded-lg text-sm font-medium w-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Add your first host
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Or double-click any host in the sidebar to connect
          </p>
        </div>
      </div>
    </div>
  )
}
