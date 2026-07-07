import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/app'
import type { Host, BatchTaskStatus } from '../../../shared/types'

interface HostResult {
  host: Host
  status: BatchTaskStatus
  output: string
  exitCode?: number
  startedAt?: number
  endedAt?: number
  error?: string
}

let jobCounter = 0
function genJobId() {
  return `job-${Date.now()}-${++jobCounter}`
}

function duration(r: HostResult): string {
  if (!r.startedAt) return ''
  const end = r.endedAt ?? Date.now()
  const ms = end - r.startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const STATUS_COLOR: Record<BatchTaskStatus, string> = {
  pending: 'var(--text-muted)',
  running: 'var(--warning)',
  success: 'var(--success)',
  failed: 'var(--danger)',
  stopped: 'var(--text-muted)'
}

const STATUS_LABEL: Record<BatchTaskStatus, string> = {
  pending: 'Pending',
  running: 'Running…',
  success: 'Success',
  failed: 'Failed',
  stopped: 'Stopped'
}

export function BatchPanel() {
  const { hosts, groups } = useAppStore()

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [command, setCommand] = useState('')
  const [timeout, setTimeout_] = useState(30)
  const [results, setResults] = useState<HostResult[]>([])
  const [running, setRunning] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [activeHostId, setActiveHostId] = useState<number | null>(null)
  const [filterGroup, setFilterGroup] = useState<number | 'all'>('all')
  const [searchHost, setSearchHost] = useState('')

  const unsubRefs = useRef<Array<() => void>>([])

  const filteredHosts = hosts.filter((h) => {
    const matchGroup = filterGroup === 'all' || h.groupId === filterGroup
    const matchSearch =
      !searchHost ||
      h.name.toLowerCase().includes(searchHost.toLowerCase()) ||
      h.host.toLowerCase().includes(searchHost.toLowerCase())
    return matchGroup && matchSearch
  })

  function toggleHost(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === filteredHosts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredHosts.map((h) => h.id)))
    }
  }

  function updateResult(hostId: number, patch: Partial<HostResult>) {
    setResults((prev) =>
      prev.map((r) => (r.host.id === hostId ? { ...r, ...patch } : r))
    )
  }

  function appendOutput(hostId: number, text: string) {
    setResults((prev) =>
      prev.map((r) =>
        r.host.id === hostId ? { ...r, output: r.output + text } : r
      )
    )
  }

  const cleanup = useCallback(() => {
    unsubRefs.current.forEach((fn) => fn())
    unsubRefs.current = []
  }, [])

  async function handleRun() {
    if (!command.trim() || selectedIds.size === 0) return

    cleanup()

    const id = genJobId()
    setJobId(id)
    setRunning(true)

    const targetHosts = hosts.filter((h) => selectedIds.has(h.id))

    const initial: HostResult[] = targetHosts.map((h) => ({
      host: h,
      status: 'pending',
      output: ''
    }))
    setResults(initial)
    setActiveHostId(targetHosts[0]?.id ?? null)

    // Subscribe events for every host
    for (const host of targetHosts) {
      const hid = host.id

      unsubRefs.current.push(
        window.nexops.batch.onStart(id, hid, ({ startedAt }) => {
          updateResult(hid, { status: 'running', startedAt })
        }),
        window.nexops.batch.onData(id, hid, (data) => {
          appendOutput(hid, data)
        }),
        window.nexops.batch.onStderr(id, hid, (data) => {
          appendOutput(hid, `\x1b[31m${data}\x1b[0m`)
        }),
        window.nexops.batch.onDone(id, hid, ({ exitCode, endedAt }) => {
          updateResult(hid, {
            status: exitCode === 0 ? 'success' : 'failed',
            exitCode,
            endedAt
          })
        }),
        window.nexops.batch.onError(id, hid, ({ error, endedAt }) => {
          updateResult(hid, { status: 'failed', error, endedAt })
          appendOutput(hid, `\n[Error: ${error}]`)
        })
      )
    }

    unsubRefs.current.push(
      window.nexops.batch.onFinished(id, () => {
        setRunning(false)
        cleanup()
      })
    )

    await window.nexops.batch.run(id, command.trim(), targetHosts.map((h) => h.id))
  }

  async function handleStop() {
    if (jobId) {
      await window.nexops.batch.stop(jobId)
      setResults((prev) =>
        prev.map((r) =>
          r.status === 'running' || r.status === 'pending'
            ? { ...r, status: 'stopped', endedAt: Date.now() }
            : r
        )
      )
      setRunning(false)
      cleanup()
    }
  }

  function handleExport() {
    const lines: string[] = []
    for (const r of results) {
      lines.push(`${'='.repeat(60)}`)
      lines.push(`Host: ${r.host.name} (${r.host.username}@${r.host.host})`)
      lines.push(`Status: ${r.status}  Exit: ${r.exitCode ?? '—'}  Duration: ${duration(r)}`)
      lines.push(`${'─'.repeat(60)}`)
      lines.push(r.output || '(no output)')
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexops-batch-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => () => cleanup(), [cleanup])

  const activeResult = results.find((r) => r.host.id === activeHostId)
  const successCount = results.filter((r) => r.status === 'success').length
  const failedCount = results.filter((r) => r.status === 'failed').length
  const runningCount = results.filter((r) => r.status === 'running').length

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Top Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Batch Ops
        </span>

        {results.length > 0 && (
          <div className="flex items-center gap-3 ml-2">
            <Pill label={`${successCount} ok`} color="var(--success)" />
            <Pill label={`${failedCount} fail`} color="var(--danger)" />
            {runningCount > 0 && <Pill label={`${runningCount} running`} color="var(--warning)" />}
          </div>
        )}

        <div className="flex-1" />

        {results.length > 0 && (
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded text-xs"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)'
            }}
          >
            Export
          </button>
        )}

        <button
          onClick={running ? handleStop : handleRun}
          disabled={!running && (selectedIds.size === 0 || !command.trim())}
          className="px-4 py-1 rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: running ? 'var(--danger)' : 'var(--accent)',
            color: '#fff'
          }}
        >
          {running ? 'Stop All' : `Run on ${selectedIds.size} host${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Command Input */}
      <div
        className="px-4 py-3 flex-shrink-0 space-y-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !running) handleRun()
            }}
            placeholder="Command to run on all selected hosts (Ctrl+Enter to execute)"
            className="flex-1 h-8 rounded-md px-2 text-xs font-mono outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Timeout:</span>
            <input
              type="number"
              min={5}
              max={600}
              value={timeout}
              onChange={(e) => setTimeout_(Number(e.target.value))}
              className="w-14 h-8 rounded-md px-2 text-xs text-center outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>s</span>
          </div>
        </div>
      </div>

      {/* Main body: host selector + result viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Host selector */}
        <div
          className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          {/* Filter row */}
          <div className="px-2 py-2 space-y-1.5">
            <input
              value={searchHost}
              onChange={(e) => setSearchHost(e.target.value)}
              placeholder="Filter hosts…"
              className="w-full h-7 rounded px-2 text-xs outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
            <select
              value={String(filterGroup)}
              onChange={(e) =>
                setFilterGroup(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full h-7 rounded px-2 text-xs outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)'
              }}
            >
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select all */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
            style={{ borderBottom: '1px solid var(--border)' }}
            onClick={toggleAll}
          >
            <input
              type="checkbox"
              readOnly
              checked={filteredHosts.length > 0 && selectedIds.size === filteredHosts.length}
              className="accent-blue-500"
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Select all ({filteredHosts.length})
            </span>
          </div>

          {/* Host list */}
          <div className="flex-1 overflow-y-auto">
            {filteredHosts.map((host) => {
              const result = results.find((r) => r.host.id === host.id)
              const isActive = activeHostId === host.id
              return (
                <div
                  key={host.id}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                  style={{
                    background: isActive ? 'rgba(56,139,253,0.1)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent'
                  }}
                  onClick={() => setActiveHostId(host.id)}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActive
                      ? 'rgba(56,139,253,0.1)'
                      : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(host.id)}
                    onChange={() => toggleHost(host.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-blue-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                      {host.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {host.host}
                    </div>
                  </div>
                  {result && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: STATUS_COLOR[result.status] }}
                      title={STATUS_LABEL[result.status]}
                    />
                  )}
                </div>
              )
            })}

            {filteredHosts.length === 0 && (
              <div
                className="flex items-center justify-center h-20 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                No hosts
              </div>
            )}
          </div>
        </div>

        {/* Result viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeResult ? (
            <>
              {/* Host header */}
              <div
                className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: STATUS_COLOR[activeResult.status] }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {activeResult.host.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeResult.host.username}@{activeResult.host.host}
                </span>
                <span className="text-xs" style={{ color: STATUS_COLOR[activeResult.status] }}>
                  {STATUS_LABEL[activeResult.status]}
                </span>
                {activeResult.exitCode !== undefined && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    exit {activeResult.exitCode}
                  </span>
                )}
                <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {duration(activeResult)}
                </span>
                {activeResult.status === 'running' && jobId && (
                  <button
                    onClick={() => window.nexops.batch.stop(jobId, activeResult.host.id)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: 'rgba(248,81,73,0.15)',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)'
                    }}
                  >
                    Stop
                  </button>
                )}
              </div>

              {/* Output */}
              <OutputView
                text={activeResult.output}
                status={activeResult.status}
                error={activeResult.error}
              />
            </>
          ) : (
            <EmptyResultView hasHosts={filteredHosts.length > 0} hasSelected={selectedIds.size > 0} />
          )}
        </div>
      </div>
    </div>
  )
}

function OutputView({
  text,
  status,
  error
}: {
  text: string
  status: BatchTaskStatus
  error?: string
}) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [text])

  return (
    <pre
      ref={ref}
      className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed"
      style={{
        background: '#0d1117',
        color: status === 'failed' ? '#ffa198' : 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}
    >
      {text || (
        <span style={{ color: 'var(--text-muted)' }}>
          {status === 'pending' ? 'Waiting to run…' : status === 'running' ? '' : '(no output)'}
        </span>
      )}
      {error && <span style={{ color: 'var(--danger)' }}>{'\n[Error] ' + error}</span>}
      {status === 'running' && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 align-middle animate-pulse"
          style={{ background: 'var(--warning)' }}
        />
      )}
    </pre>
  )
}

function EmptyResultView({
  hasHosts,
  hasSelected
}: {
  hasHosts: boolean
  hasSelected: boolean
}) {
  return (
    <div className="flex items-center justify-center flex-1">
      <div className="text-center space-y-2">
        <div className="text-3xl opacity-20">⚡</div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {!hasHosts
            ? 'No hosts available. Add hosts first.'
            : !hasSelected
              ? 'Select hosts on the left, enter a command, and run.'
              : 'Select a host to view its output.'}
        </p>
      </div>
    </div>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}
