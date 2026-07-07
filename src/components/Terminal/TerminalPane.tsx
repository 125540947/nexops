import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
  isActive: boolean
  onReady?: () => void
}

export function TerminalPane({ sessionId, isActive, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Menlo', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Send keypresses to SSH
    const disposeOnData = term.onData((data) => {
      window.nexops.ssh.write(sessionId, data)
    })

    // Receive SSH output
    const unsubData = window.nexops.ssh.onData(sessionId, (data) => {
      term.write(data)
    })

    const unsubClose = window.nexops.ssh.onClose(sessionId, () => {
      term.writeln('\r\n\x1b[31m[Connection closed]\x1b[0m')
    })

    const unsubError = window.nexops.ssh.onError(sessionId, (msg) => {
      term.writeln(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m`)
    })

    onReady?.()

    return () => {
      disposeOnData.dispose()
      unsubData()
      unsubClose()
      unsubError()
      term.dispose()
    }
  }, [sessionId])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      if (!fitAddonRef.current || !termRef.current) return
      try {
        fitAddonRef.current.fit()
        const { cols, rows } = termRef.current
        window.nexops.ssh.resize(sessionId, cols, rows)
      } catch {
        // ignore fit errors during resize
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [sessionId])

  // Focus when tab becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus()
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="xterm-container"
      style={{ width: '100%', height: '100%', padding: '6px' }}
    />
  )
}
