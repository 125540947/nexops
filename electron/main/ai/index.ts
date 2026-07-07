import type { AiMessage, AiSettings } from '../../../shared/types'

const controllers = new Map<string, AbortController>()

export async function streamChat(
  chatId: string,
  messages: AiMessage[],
  settings: AiSettings,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const controller = new AbortController()
  controllers.set(chatId, controller)

  const allMessages: AiMessage[] = settings.systemPrompt
    ? [{ role: 'system', content: settings.systemPrompt }, ...messages]
    : messages

  try {
    if (settings.provider === 'ollama') {
      await streamOllama(allMessages, settings, controller, onChunk, onDone, onError)
    } else {
      await streamOpenAI(allMessages, settings, controller, onChunk, onDone, onError)
    }
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      onDone()
    } else {
      onError(String(err))
    }
  } finally {
    controllers.delete(chatId)
  }
}

export function abortChat(chatId: string): void {
  controllers.get(chatId)?.abort()
}

async function streamOllama(
  messages: AiMessage[],
  settings: AiSettings,
  controller: AbortController,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const url = `${settings.ollamaUrl.replace(/\/$/, '')}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ollamaModel || 'llama3.2',
      messages,
      stream: true
    }),
    signal: controller.signal
  })

  if (!res.ok || !res.body) {
    onError(`Ollama ${res.status}: ${await res.text()}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        if (obj.message?.content) onChunk(obj.message.content)
        if (obj.done) { onDone(); return }
      } catch { /* skip malformed line */ }
    }
  }
  onDone()
}

async function streamOpenAI(
  messages: AiMessage[],
  settings: AiSettings,
  controller: AbortController,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const base = (settings.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openaiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel || 'gpt-4o-mini',
      messages,
      stream: true
    }),
    signal: controller.signal
  })

  if (!res.ok || !res.body) {
    onError(`API ${res.status}: ${await res.text()}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') { onDone(); return }
      try {
        const obj = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
        const chunk = obj.choices?.[0]?.delta?.content
        if (chunk) onChunk(chunk)
      } catch { /* skip */ }
    }
  }
  onDone()
}

export async function listOllamaModels(ollamaUrl: string): Promise<string[]> {
  try {
    const url = `${ollamaUrl.replace(/\/$/, '')}/api/tags`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const json = await res.json() as { models?: Array<{ name: string }> }
    return (json.models ?? []).map(m => m.name)
  } catch {
    return []
  }
}
