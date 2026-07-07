import { useState, useRef, useEffect, useCallback } from 'react'
import type { AiSettings } from '../../../shared/types'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',
  systemPrompt: 'You are an expert DevOps/SRE assistant. Help with Linux, SSH, databases, shell scripting, and infrastructure. Be concise and practical. Use code blocks for commands and scripts.'
}

let msgCounter = 0
function newId() { return `m${Date.now()}-${++msgCounter}` }

export function AiPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeChatId = useRef<string | null>(null)
  const cleanupChunk = useRef<(() => void) | null>(null)

  useEffect(() => {
    window.nexops.ai.settings.get().then((r) => {
      setSettings(r.ok && r.data ? r.data : { ...DEFAULT_SETTINGS })
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming || !settings) return

    const userMsg: DisplayMessage = { id: newId(), role: 'user', content: input.trim() }
    const assistantId = newId()
    const assistantMsg: DisplayMessage = { id: assistantId, role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    const chatId = `chat-${Date.now()}`
    activeChatId.current = chatId

    const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    const stopChunk = window.nexops.ai.onChunk(chatId, (text) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m))
      )
    })
    cleanupChunk.current = stopChunk

    const finish = () => {
      cleanupChunk.current?.()
      cleanupChunk.current = null
      activeChatId.current = null
      setStreaming(false)
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      )
    }

    window.nexops.ai.onDone(chatId, finish)
    window.nexops.ai.onError(chatId, (msg) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `Error: ${msg}`, streaming: false } : m
        )
      )
      cleanupChunk.current?.()
      cleanupChunk.current = null
      activeChatId.current = null
      setStreaming(false)
    })

    await window.nexops.ai.chat(chatId, apiMessages, settings)
  }, [input, streaming, settings, messages])

  async function handleAbort() {
    if (activeChatId.current) {
      await window.nexops.ai.abort(activeChatId.current)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const modelLabel = settings
    ? settings.provider === 'ollama'
      ? settings.ollamaModel || 'llama3.2'
      : settings.openaiModel || 'gpt-4o-mini'
    : '…'

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--bg-surface)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          AI Assistant
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-xs"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          {modelLabel}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowSettings(true)}
          className="opacity-50 hover:opacity-100 transition-opacity text-xs px-1"
          style={{ color: 'var(--text-secondary)' }}
          title="Settings"
        >
          ⚙
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="opacity-50 hover:opacity-100 transition-opacity text-xs px-1"
            style={{ color: 'var(--text-secondary)' }}
            title="Clear chat"
          >
            ✕ Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="opacity-50 hover:opacity-100 transition-opacity text-sm px-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="text-3xl opacity-20">🤖</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ask anything about Linux, SSH,
                <br />databases, or infrastructure
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[90%] rounded-lg px-3 py-2 text-xs"
              style={{
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)'
              }}
            >
              {msg.role === 'assistant' ? (
                <AssistantContent content={msg.content} streaming={msg.streaming} />
              ) : (
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 p-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 rounded px-2 py-1.5 text-xs resize-none outline-none"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              minHeight: 52,
              maxHeight: 120
            }}
          />
          {streaming ? (
            <button
              onClick={handleAbort}
              className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !settings}
              className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Settings overlay */}
      {showSettings && settings && (
        <SettingsOverlay
          settings={settings}
          onSave={async (s) => {
            await window.nexops.ai.settings.save(s)
            setSettings(s)
            setShowSettings(false)
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function AssistantContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const parts = parseContent(content)

  return (
    <div className="space-y-1">
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <CodeBlock key={i} lang={part.lang ?? ''} code={part.text} />
        ) : (
          <p key={i} className="text-xs leading-relaxed" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderInline(part.text)}
          </p>
        )
      )}
      {streaming && (
        <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm" style={{ background: 'var(--accent)' }} />
      )}
    </div>
  )
}

interface ContentPart {
  type: 'text' | 'code'
  text: string
  lang?: string
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = codeBlockRe.exec(content)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', text: content.slice(last, m.index) })
    }
    parts.push({ type: 'code', text: m[2].trim(), lang: m[1] || undefined })
    last = m.index + m[0].length
  }

  if (last < content.length) {
    parts.push({ type: 'text', text: content.slice(last) })
  }

  return parts.length ? parts : [{ type: 'text', text: content }]
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<span key={k++}>{text.slice(last, m.index)}</span>)
    }
    nodes.push(
      <code
        key={k++}
        className="px-1 rounded"
        style={{ background: 'rgba(255,255,255,0.12)', fontFamily: 'monospace', fontSize: '0.75em' }}
      >
        {m[1]}
      </code>
    )
    last = m.index + m[0].length
  }

  if (last < text.length) {
    nodes.push(<span key={k++}>{text.slice(last)}</span>)
  }

  return nodes
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {lang && (
        <div
          className="px-2 py-0.5 text-xs"
          style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
        >
          {lang}
        </div>
      )}
      <pre
        className="p-3 text-xs overflow-x-auto m-0"
        style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
      >
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-1 right-1 px-1.5 py-0.5 text-xs rounded transition-opacity"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: 0.7 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  )
}

// ─── Settings Overlay ─────────────────────────────────────────────────────────

function SettingsOverlay({
  settings,
  onSave,
  onCancel
}: {
  settings: AiSettings
  onSave: (s: AiSettings) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<AiSettings>({ ...settings })
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  async function fetchModels() {
    setLoadingModels(true)
    const r = await window.nexops.ai.models(draft.ollamaUrl)
    if (r.ok && r.data) setModels(r.data)
    setLoadingModels(false)
  }

  function field(label: string, node: React.ReactNode) {
    return (
      <div className="space-y-1">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        {node}
      </div>
    )
  }

  const inputCls = 'w-full rounded px-2 py-1.5 text-xs outline-none'
  const inputStyle = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)'
  }

  return (
    <div
      className="absolute inset-0 flex flex-col z-20"
      style={{ background: 'var(--bg-surface)' }}
    >
      <div
        className="flex items-center px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>AI Settings</span>
        <button onClick={onCancel} className="ml-auto opacity-50 hover:opacity-100">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Provider */}
        <div className="space-y-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Provider</label>
          <div className="flex gap-2">
            {(['ollama', 'openai'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setDraft({ ...draft, provider: p })}
                className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: draft.provider === p ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: draft.provider === p ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)'
                }}
              >
                {p === 'ollama' ? 'Ollama (local)' : 'OpenAI-compatible'}
              </button>
            ))}
          </div>
        </div>

        {draft.provider === 'ollama' && (
          <>
            {field('Ollama URL',
              <input
                className={inputCls}
                style={inputStyle}
                value={draft.ollamaUrl}
                onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            )}
            {field('Model',
              <div className="flex gap-1">
                {models.length > 0 ? (
                  <select
                    className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                    value={draft.ollamaModel}
                    onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
                  >
                    {models.map((m) => <option key={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    className={inputCls}
                    style={{ ...inputStyle, flex: 1 }}
                    value={draft.ollamaModel}
                    onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
                    placeholder="llama3.2"
                  />
                )}
                <button
                  onClick={fetchModels}
                  disabled={loadingModels}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {loadingModels ? '…' : '↻'}
                </button>
              </div>
            )}
          </>
        )}

        {draft.provider === 'openai' && (
          <>
            {field('Base URL',
              <input
                className={inputCls}
                style={inputStyle}
                value={draft.openaiBaseUrl}
                onChange={(e) => setDraft({ ...draft, openaiBaseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            )}
            {field('API Key',
              <input
                type="password"
                className={inputCls}
                style={inputStyle}
                value={draft.openaiKey}
                onChange={(e) => setDraft({ ...draft, openaiKey: e.target.value })}
                placeholder="sk-…"
              />
            )}
            {field('Model',
              <input
                className={inputCls}
                style={inputStyle}
                value={draft.openaiModel}
                onChange={(e) => setDraft({ ...draft, openaiModel: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            )}
          </>
        )}

        {field('System Prompt',
          <textarea
            className={inputCls}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            value={draft.systemPrompt}
            onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
            rows={4}
          />
        )}
      </div>

      <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded text-xs"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(draft)}
          className="flex-1 py-1.5 rounded text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
