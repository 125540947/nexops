import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type Tab } from './stores/app'
import { useI18n } from './i18n'
import { Titlebar } from './components/Titlebar/Titlebar'
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
  const { t } = useI18n()
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
      const result = await window.nexops.ssh.connect(sessionId, host)
      if (!result.ok) {
        updateTabStatus(sessionId, 'error', result.error)
        return
      }
      updateTabStatus(sessionId, 'connected')
      window.nexops.ssh.onClose(sessionId, () => updateTabStatus(sessionId, 'disconnected'))
      window.nexops.ssh.onError(sessionId, (msg) => updateTabStatus(sessionId, 'error', msg))
    },
    [openTab, updateTabStatus]
  )

  async function handleCloseTab(tabId: string) {
    if (tabId === BATCH_TAB_ID) { closeTab(tabId); return }
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) await window.nexops.ssh.disconnect(tab.sessionId)
    closeTab(tabId)
  }

  function openDbTab(connId: number) {
    const tabId = `db-${connId}`
    const conn = dbConnections.find((d) => d.id === connId)
    if (!conn) return
    openTab({ id: tabId, hostId: -1, hostName: conn.name, hostLabel: conn.type, type: 'db', sessionId: tabId, status: 'connected' })
  }

  function openBatchTab() {
    if (tabs.find((t) => t.id === BATCH_TAB_ID)) { setActiveTab(BATCH_TAB_ID); return }
    openTab({ id: BATCH_TAB_ID, hostId: -1, hostName: 'Batch Ops', hostLabel: 'Multi-host execution', type: 'batch', sessionId: BATCH_TAB_ID, status: 'connected' })
  }

  function startResize() {
    setResizing(true)
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.max(160, Math.min(400, e.clientX)))
    const onUp = () => { setResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Custom Titlebar with menu + window controls */}
      <Titlebar
        onAddHost={() => setShowAddHost(true)}
        onAddDb={() => setShowAddDb(true)}
        onToggleAi={toggleAiPanel}
        aiOpen={aiPanelOpen}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
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
          className="w-1 flex-shrink-0 cursor-col-resize"
          style={{ background: resizing ? 'var(--accent)' : 'transparent', transition: 'background 0.15s' }}
          onMouseDown={startResize}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={(e) => { if (!resizing) e.currentTarget.style.background = 'transparent' }}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex items-end flex-shrink-0"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', minHeight: 34 }}
          >
            {tabs.length === 0 && (
              <div className="flex-1 flex items-center justify-center pb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t.tabs.connectHint}
              </div>
            )}
            <div className="flex items-end flex-1 overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer flex-shrink-0 text-xs border-r transition-colors"
                  style={{
                    background: activeTabId === tab.id ? 'var(--bg-base)' : 'transparent',
                    borderColor: 'var(--border)',
                    color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderTop: activeTabId === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                    maxWidth: 200
                  }}
                >
                  <span className="text-xs">
                    {tab.type === 'sftp' ? '≡' : tab.type === 'batch' ? '⚡' : tab.type === 'db' ? '🗄' : '⌨'}
                  </span>
                  <StatusDot status={tab.status} />
                  <span className="truncate" title={tab.hostLabel}>{tab.hostName}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }}
                    className="ml-1 opacity-40 hover:opacity-100 transition-opacity leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tab Content + AI Panel */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
              {tabs.length === 0 && <WelcomeScreen onAddHost={() => setShowAddHost(true)} />}

              {tabs.map((tab) => (
                <div key={tab.id} className="absolute inset-0" style={{ display: activeTabId === tab.id ? 'block' : 'none' }}>
                  {tab.status === 'connecting' && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-3">
                        <div className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto animate-spin" style={{ borderColor: 'var(--accent)' }} />
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {t.conn.connecting} {tab.hostLabel}…
                        </p>
                      </div>
                    </div>
                  )}
                  {tab.status === 'error' && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-2 max-w-md px-6">
                        <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{t.conn.failed}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tab.errorMsg}</p>
                      </div>
                    </div>
                  )}
                  {tab.status === 'connected' && tab.type === 'terminal' && (
                    <TerminalPane sessionId={tab.sessionId} isActive={activeTabId === tab.id} />
                  )}
                  {tab.status === 'connected' && tab.type === 'sftp' && (
                    <SftpPanel sessionId={tab.sessionId} />
                  )}
                  {tab.type === 'batch' && <BatchPanel />}
                  {tab.type === 'db' && (() => {
                    const connId = Number(tab.id.replace('db-', ''))
                    const conn = dbConnections.find((d) => d.id === connId)
                    return conn ? <DbPanel key={tab.id} conn={conn} /> : null
                  })()}
                </div>
              ))}
            </div>

            {aiPanelOpen && (
              <div className="flex-shrink-0 flex flex-col" style={{ width: 360, borderLeft: '1px solid var(--border)' }}>
                <AiPanel onClose={toggleAiPanel} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddDb && (
        <AddDbModal
          onClose={() => setShowAddDb(false)}
          onSave={async (input) => {
            const result = await window.nexops.db.create(input)
            if (result.ok && result.data) addDbConnection(result.data)
          }}
        />
      )}
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
  const color = { connecting: 'var(--warning)', connected: 'var(--success)', disconnected: 'var(--text-muted)', error: 'var(--danger)' }[status]
  return <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
}

function WelcomeScreen({ onAddHost }: { onAddHost: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-5xl opacity-20">⌘</div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>NexOps</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.welcome.subtitle}</p>
        </div>
        <div className="space-y-2">
          <button
            onClick={onAddHost}
            className="px-4 py-2 rounded-lg text-sm font-medium w-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t.welcome.addFirstHost}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.welcome.hint}</p>
        </div>
      </div>
    </div>
  )
}
