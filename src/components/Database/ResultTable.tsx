import { useState } from 'react'
import type { DbQueryResult } from '../../../shared/types'

interface Props {
  result: DbQueryResult
}

const PAGE_SIZE = 100

export function ResultTable({ result }: Props) {
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [filter, setFilter] = useState('')

  if (result.error) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center space-y-2 max-w-lg">
          <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>Query Error</p>
          <pre className="text-xs text-left p-3 rounded-lg whitespace-pre-wrap"
            style={{ background: '#1a0a0a', color: '#ffa198', border: '1px solid #3d1c1c' }}>
            {result.error}
          </pre>
        </div>
      </div>
    )
  }

  if (result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Query OK · {result.rowCount} rows affected · {result.duration}ms
        </p>
      </div>
    )
  }

  // Filter rows
  const filtered = filter
    ? result.rows.filter((row) =>
        row.some((cell) => String(cell ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : result.rows

  // Sort
  const sorted =
    sortCol !== null
      ? [...filtered].sort((a, b) => {
          const av = a[sortCol] ?? ''
          const bv = b[sortCol] ?? ''
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
          return sortAsc ? cmp : -cmp
        })
      : filtered

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(colIdx: number) {
    if (sortCol === colIdx) setSortAsc((a) => !a)
    else { setSortCol(colIdx); setSortAsc(true) }
    setPage(0)
  }

  function exportCsv() {
    const lines = [result.columns.join(',')]
    for (const row of sorted) {
      lines.push(row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-result-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}
          placeholder="Filter results…"
          className="h-6 rounded px-2 text-xs outline-none w-48"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
          {filter && result.rows.length !== filtered.length && ` (of ${result.rows.length})`}
          {' '}· {result.duration}ms
        </span>
        <button onClick={exportCsv}
          className="px-2 py-0.5 rounded text-xs"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-surface)' }}>
            <tr>
              <th className="w-10 px-2 py-1.5 text-right border-b border-r font-normal"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>#</th>
              {result.columns.map((col, i) => (
                <th key={i}
                  className="px-3 py-1.5 text-left border-b border-r cursor-pointer select-none font-medium whitespace-nowrap"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onClick={() => handleSort(i)}>
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === i && <span style={{ color: 'var(--accent)' }}>{sortAsc ? '↑' : '↓'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-2 py-1 text-right border-b border-r select-none"
                  style={{ borderColor: 'rgba(48,54,61,0.5)', color: 'var(--text-muted)' }}>
                  {page * PAGE_SIZE + ri + 1}
                </td>
                {row.map((cell, ci) => (
                  <td key={ci}
                    className="px-3 py-1 border-b border-r max-w-xs truncate"
                    style={{ borderColor: 'rgba(48,54,61,0.5)', color: cell === null ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    title={String(cell ?? '')}>
                    {cell === null ? <span className="italic">NULL</span> : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            className="px-2 py-0.5 rounded text-xs disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>«</button>
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}
            className="px-2 py-0.5 rounded text-xs disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>‹</button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {page + 1} / {pageCount}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount - 1}
            className="px-2 py-0.5 rounded text-xs disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>›</button>
          <button onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}
            className="px-2 py-0.5 rounded text-xs disabled:opacity-30"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>»</button>
        </div>
      )}
    </div>
  )
}
