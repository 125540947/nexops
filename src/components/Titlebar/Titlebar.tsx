import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n, type Locale } from '../../i18n'

interface TitlebarProps {
  onAddHost: () => void
  onAddDb: () => void
  onToggleAi: () => void
  aiOpen: boolean
}

export function Titlebar({ onAddHost, onAddDb, onToggleAi, aiOpen }: TitlebarProps) {
  const { t, locale, setLocale } = useI18n()
  const [isMaximized, setIsMaximized] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    window.nexops.window.isMaximized().then(setIsMaximized)
    const off = window.nexops.window.onMaximized(setIsMaximized)
    return off
  }, [])

  useEffect(() => {
    if (openMenu === null) return
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenu])

  function toggleMenu(name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenMenu(openMenu === name ? null : name)
  }

  const menuItemCls = 'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors'
  const menuItemStyle = { color: 'var(--text-primary)' }
  const menuHoverStyle = { background: 'var(--bg-hover)' }

  function MenuItem({
    label,
    shortcut,
    onClick,
    danger,
  }: {
    label: string
    shortcut?: string
    onClick: () => void
    danger?: boolean
  }) {
    const [hovered, setHovered] = useState(false)
    return (
      <button
        className={menuItemCls}
        style={{
          ...menuItemStyle,
          color: danger ? 'var(--danger)' : 'var(--text-primary)',
          background: hovered ? 'var(--accent)' : 'transparent',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); setOpenMenu(null); onClick() }}
      >
        <span className="flex-1">{label}</span>
        {shortcut && (
          <span style={{ color: hovered ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', fontSize: 10 }}>
            {shortcut}
          </span>
        )}
      </button>
    )
  }

  function MenuSep() {
    return <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 1000,
    minWidth: 200,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    paddingTop: 4,
    paddingBottom: 4,
  }

  return (
    <div
      className="flex items-center flex-shrink-0 titlebar-drag"
      style={{
        height: 38,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: 4,
      }}
    >
      {/* App icon / name */}
      <div
        className="flex items-center gap-1.5 px-2 text-xs font-semibold flex-shrink-0 titlebar-no-drag select-none"
        style={{ color: 'var(--text-primary)' }}
      >
        <span style={{ fontSize: 14 }}>⌘</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>NexOps</span>
      </div>

      {/* ── Menus ── */}
      <div className="flex items-center titlebar-no-drag" style={{ height: '100%' }}>

        {/* File */}
        <div className="relative" style={{ height: '100%' }}>
          <button
            className="h-full px-3 text-xs transition-colors"
            style={{
              color: openMenu === 'file' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: openMenu === 'file' ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={(e) => toggleMenu('file', e)}
          >
            {t.menu.file}
          </button>
          {openMenu === 'file' && (
            <div style={dropdownStyle}>
              <MenuItem label={t.menu.newHost} shortcut="Ctrl+N" onClick={onAddHost} />
              <MenuItem label={t.menu.newDbConn} onClick={onAddDb} />
              <MenuSep />
              <MenuItem label={t.menu.quit} shortcut="Alt+F4" onClick={() => window.nexops.window.close()} danger />
            </div>
          )}
        </div>

        {/* View */}
        <div className="relative" style={{ height: '100%' }}>
          <button
            className="h-full px-3 text-xs transition-colors"
            style={{
              color: openMenu === 'view' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: openMenu === 'view' ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={(e) => toggleMenu('view', e)}
          >
            {t.menu.view}
          </button>
          {openMenu === 'view' && (
            <div style={dropdownStyle}>
              <MenuItem label={t.menu.toggleAi} shortcut="Ctrl+Shift+A" onClick={onToggleAi} />
              <MenuSep />
              <MenuItem label={t.menu.zoomIn} shortcut="Ctrl+=" onClick={() => { /* webContents handled by Electron */ }} />
              <MenuItem label={t.menu.zoomOut} shortcut="Ctrl+-" onClick={() => { }} />
              <MenuItem label={t.menu.resetZoom} shortcut="Ctrl+0" onClick={() => { }} />
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative" style={{ height: '100%' }}>
          <button
            className="h-full px-3 text-xs transition-colors"
            style={{
              color: openMenu === 'help' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: openMenu === 'help' ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={(e) => toggleMenu('help', e)}
          >
            {t.menu.help}
          </button>
          {openMenu === 'help' && (
            <div style={dropdownStyle}>
              <MenuItem label={t.menu.about} onClick={() => {}} />
            </div>
          )}
        </div>

        {/* Language */}
        <div className="relative" style={{ height: '100%' }}>
          <button
            className="h-full px-3 text-xs transition-colors"
            style={{
              color: openMenu === 'lang' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: openMenu === 'lang' ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={(e) => toggleMenu('lang', e)}
          >
            {locale === 'zh' ? '中文' : 'EN'}
          </button>
          {openMenu === 'lang' && (
            <div style={dropdownStyle}>
              {(['en', 'zh'] as Locale[]).map((l) => (
                <button
                  key={l}
                  className={menuItemCls}
                  style={{
                    ...menuItemStyle,
                    fontWeight: locale === l ? 600 : 400,
                    background: locale === l ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onClick={(e) => { e.stopPropagation(); setLocale(l); setOpenMenu(null) }}
                >
                  {l === 'en' ? 'English' : '中文'}
                  {locale === l && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag region spacer */}
      <div className="flex-1" />

      {/* AI toggle */}
      <button
        onClick={onToggleAi}
        className="flex-shrink-0 flex items-center gap-1 px-3 h-full text-xs transition-colors titlebar-no-drag"
        style={{
          background: aiOpen ? 'var(--accent)' : 'transparent',
          color: aiOpen ? '#fff' : 'var(--text-secondary)',
          borderLeft: '1px solid var(--border)',
        }}
        title={t.menu.toggleAi}
      >
        🤖 {t.ai.toggle}
      </button>

      {/* Window controls */}
      <div className="flex items-center flex-shrink-0 titlebar-no-drag" style={{ height: '100%' }}>
        <WinBtn
          title={t.window.minimize}
          onClick={() => window.nexops.window.minimize()}
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </WinBtn>
        <WinBtn
          title={isMaximized ? t.window.restore : t.window.maximize}
          onClick={() => window.nexops.window.maximize()}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" />
              <polyline points="0,2 0,10 8,10" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0" y="0" width="10" height="10" />
            </svg>
          )}
        </WinBtn>
        <WinBtn
          title={t.window.close}
          onClick={() => window.nexops.window.close()}
          danger
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </WinBtn>
      </div>
    </div>
  )
}

function WinBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? (danger ? '#c42b1c' : 'var(--bg-hover)') : 'transparent',
        color: hovered ? '#fff' : 'var(--text-muted)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  )
}
