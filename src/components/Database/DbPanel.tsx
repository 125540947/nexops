import { useState, useEffect, useRef } from 'react'
import type { DbConnection, DbQueryResult } from '../../../shared/types'
import { ResultTable } from './ResultTable'

interface HistoryEntry {
  sql: string
  time: number
  ok: boolean
}

const TYPE_ICON: Record<string, string> = { mysql: '🐬', postgresql: '🐘', redis: '⚡' }
const TYPE_COLOR: Record<string, string> = {
  mysql: '#00758f',
  postgresql: '#336791',
  redis: '#dc382d'
}

interface Props {
  conn: DbConnection
  sshSessionId?: string
}

export function DbPanel({ conn, sshSessionId }: Props) {
  const [sql, setSql] = useState(conn.type === 'redis' ? 'INFO server' : 'SELECT 1')
  const [result, setResult] = useState<DbQueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function runQuery() {
    if (!sql.trim() || running) return
    setRunning(true)
    const res = await window.nexops.db.query(conn, sql.trim(), sshSessionId)
    setRunning(false)
    if (res.ok && res.data) {
      setResult(res.data)
      setHistory((h) => [{ sql: sql.trim(), time: Date.now(), ok: !res.data!.error }, ...h].slice(0, 50))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }

  function applyHistory(entry: HistoryEntry) {
    setSql(entry.sql)
    setShowHistory(false)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <span className="text-base">{TYPE_ICON[conn.type] ?? '🗄'}</span>
        <div>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{conn.name}</span>
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
            {conn.username ? `${conn.username}@` : ''}{conn.host}:{conn.port}
            {conn.database ? `/${conn.database}` : ''}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full ml-1"
          style={{ background: `${TYPE_COLOR[conn.type]}22`, color: TYPE_COLOR[conn.type], border: `1px solid ${TYPE_COLOR[conn.type]}44` }}>
          {conn.type}
        </span>
        {sshSessionId && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(56,139,253,0.1)', color: 'var(--accent)', border: '1px solid rgba(56,139,253,0.3)' }}>
            SSH Tunnel
          </span>
        )}
      </div>

      {/* SQL Editor */}
      <div className="flex-shrink-0 px-4 py-3 space-y-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          spellCheck={false}
          placeholder={conn.type === 'redis' ? 'Enter Redis command (e.g. GET key)' : 'Enter SQL query (Ctrl+Enter to run)'}
          className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none resize-none"
          style={{
            background: '#0d1117',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            lineHeight: 1.6
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <div className="flex items-center gap-2">
          <button onClick={runQuery} disabled={running || !sql.trim()}
            className="px-4 py-1.5 rounded-md text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {running
              ? <><span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Running…</>
              : <>▶ Run</>
            }
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ctrl+Enter</span>
          <div className="flex-1" />
          <button onClick={() => setShowHistory((s) => !s)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            History {history.length > 0 && `(${history.length})`}
          </button>
          <button onClick={() => setSql('')}
            className="text-xs px-2 py-1 rounded"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Clear
          </button>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div className="flex-shrink-0 max-h-48 overflow-y-auto"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          {history.map((entry, i) => (
            <div key={i}
              className="flex items-start gap-2 px-3 py-2 cursor-pointer border-b"
              style={{ borderColor: 'rgba(48,54,61,0.4)' }}
              onClick={() => applyHistory(entry)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ color: entry.ok ? 'var(--success)' : 'var(--danger)' }}>
                {entry.ok ? '✓' : '✗'}
              </span>
              <span className="font-mono text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                {entry.sql}
              </span>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {new Date(entry.time).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-hidden">
        {result ? (
          <ResultTable result={result} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="text-3xl opacity-20">{TYPE_ICON[conn.type] ?? '🗄'}</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Write a query and press Ctrl+Enter to run
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
