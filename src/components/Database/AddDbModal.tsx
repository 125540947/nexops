import { useState } from 'react'
import { useAppStore } from '../../stores/app'
import type { CreateDbConnectionInput, DbType } from '../../../shared/types'

const DB_DEFAULTS: Record<DbType, { port: number; placeholder: string }> = {
  mysql:      { port: 3306, placeholder: 'mydb' },
  postgresql: { port: 5432, placeholder: 'postgres' },
  redis:      { port: 6379, placeholder: '' }
}

interface Props {
  onClose: () => void
  onSave: (input: CreateDbConnectionInput) => Promise<void>
}

export function AddDbModal({ onClose, onSave }: Props) {
  const { hosts } = useAppStore()

  const [form, setForm] = useState<CreateDbConnectionInput>({
    name: '',
    type: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    sshHostId: undefined
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField<K extends keyof CreateDbConnectionInput>(k: K, v: CreateDbConnectionInput[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleTypeChange(type: DbType) {
    setForm((f) => ({ ...f, type, port: DB_DEFAULTS[type].port }))
  }

  async function handleSave() {
    if (!form.name || !form.host) { setError('Name and host are required'); return }
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  const def = DB_DEFAULTS[form.type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] rounded-xl border shadow-2xl"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>New Database Connection</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#3d1c1c', color: 'var(--danger)' }}>{error}</div>
          )}

          <Field label="Name *">
            <Input value={form.name} onChange={(v) => setField('name', v)} placeholder="My MySQL DB" />
          </Field>

          <Field label="Type">
            <div className="flex gap-2">
              {(['mysql', 'postgresql', 'redis'] as DbType[]).map((t) => (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className="flex-1 h-8 rounded-md text-xs capitalize transition-colors"
                  style={{
                    background: form.type === t ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: form.type === t ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${form.type === t ? 'var(--accent)' : 'var(--border)'}`
                  }}>
                  {t === 'postgresql' ? 'PostgreSQL' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Host">
                <Input value={form.host} onChange={(v) => setField('host', v)} placeholder="127.0.0.1" />
              </Field>
            </div>
            <Field label="Port">
              <Input value={String(form.port)} onChange={(v) => setField('port', Number(v) || def.port)} />
            </Field>
          </div>

          {form.type !== 'redis' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username">
                  <Input value={form.username ?? ''} onChange={(v) => setField('username', v)} placeholder="root" />
                </Field>
                <Field label="Password">
                  <Input type="password" value={form.password ?? ''} onChange={(v) => setField('password', v)} placeholder="••••••••" />
                </Field>
              </div>
              <Field label="Database">
                <Input value={form.database ?? ''} onChange={(v) => setField('database', v)} placeholder={def.placeholder} />
              </Field>
            </>
          )}

          {form.type === 'redis' && (
            <Field label="Password (optional)">
              <Input type="password" value={form.password ?? ''} onChange={(v) => setField('password', v)} placeholder="Optional AUTH password" />
            </Field>
          )}

          <Field label="SSH Tunnel (optional)">
            <select className="w-full h-8 rounded-md px-2 text-xs outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={form.sshHostId ?? ''}
              onChange={(e) => setField('sshHostId', e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Direct connection</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>{h.name} ({h.username}@{h.host})</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-md text-xs"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-8 rounded-md px-2 text-xs outline-none"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
  )
}
