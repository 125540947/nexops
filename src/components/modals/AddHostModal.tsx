import { useState } from 'react'
import type { CreateHostInput, HostGroup, AuthType } from '../../../shared/types'

interface Props {
  groups: HostGroup[]
  onClose: () => void
  onSave: (input: CreateHostInput) => Promise<void>
}

export function AddHostModal({ groups, onClose, onSave }: Props) {
  const [form, setForm] = useState<CreateHostInput>({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    keyPath: '',
    passphrase: '',
    groupId: undefined,
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof CreateHostInput>(k: K, v: CreateHostInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name || !form.host || !form.username) {
      setError('Name, host and username are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function pickKey() {
    const path = await window.nexops.dialog.openFile()
    if (path) set('keyPath', path)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-[520px] rounded-xl border shadow-2xl"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            New Host
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: '#3d1c1c', color: 'var(--danger)' }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(v) => set('name', v)}
                placeholder="My Server"
              />
            </Field>
            <Field label="Group">
              <select
                className="w-full h-8 rounded-md px-2 text-xs outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
                value={form.groupId ?? ''}
                onChange={(e) => set('groupId', e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Host / IP *">
                <Input
                  value={form.host}
                  onChange={(v) => set('host', v)}
                  placeholder="192.168.1.1"
                />
              </Field>
            </div>
            <Field label="Port">
              <Input
                value={String(form.port)}
                onChange={(v) => set('port', Number(v) || 22)}
                placeholder="22"
              />
            </Field>
          </div>

          <Field label="Username *">
            <Input
              value={form.username}
              onChange={(v) => set('username', v)}
              placeholder="root"
            />
          </Field>

          <Field label="Authentication">
            <div className="flex gap-2">
              {(['password', 'key', 'agent'] as AuthType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => set('authType', t)}
                  className="flex-1 h-8 rounded-md text-xs capitalize transition-colors"
                  style={{
                    background: form.authType === t ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: form.authType === t ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${form.authType === t ? 'var(--accent)' : 'var(--border)'}`
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          {form.authType === 'password' && (
            <Field label="Password">
              <Input
                type="password"
                value={form.password ?? ''}
                onChange={(v) => set('password', v)}
                placeholder="••••••••"
              />
            </Field>
          )}

          {form.authType === 'key' && (
            <div className="space-y-3">
              <Field label="Private Key Path">
                <div className="flex gap-2">
                  <Input
                    value={form.keyPath ?? ''}
                    onChange={(v) => set('keyPath', v)}
                    placeholder="/home/user/.ssh/id_rsa"
                  />
                  <button
                    onClick={pickKey}
                    className="px-3 h-8 rounded-md text-xs whitespace-nowrap"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Browse
                  </button>
                </div>
              </Field>
              <Field label="Passphrase">
                <Input
                  type="password"
                  value={form.passphrase ?? ''}
                  onChange={(v) => set('passphrase', v)}
                  placeholder="Optional"
                />
              </Field>
            </div>
          )}

          {form.authType === 'agent' && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Uses SSH_AUTH_SOCK from environment. Make sure your SSH agent is running.
            </p>
          )}

          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes..."
              className="w-full rounded-md px-2 py-1.5 text-xs outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
          </Field>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save Host'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 rounded-md px-2 text-xs outline-none"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)'
      }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
    />
  )
}
