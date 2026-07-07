import { createContext, useContext, useState, useEffect } from 'react'

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'nexops-locale'

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  en: {
    // Menu
    menu: {
      file: 'File',
      view: 'View',
      help: 'Help',
      newHost: 'New Host',
      newDbConn: 'New Database Connection',
      quit: 'Quit',
      toggleSidebar: 'Toggle Sidebar',
      toggleAi: 'Toggle AI Panel',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset Zoom',
      about: 'About NexOps',
      docs: 'Documentation',
      reportIssue: 'Report Issue',
      language: 'Language',
    },
    // Sidebar
    sidebar: {
      hosts: 'Hosts',
      search: 'Search hosts…',
      addHost: 'Add Host',
      addGroup: 'Add Group',
      batchOps: 'Batch Ops',
      database: 'Database',
      noHosts: 'No hosts yet',
    },
    // Tabs / Content
    tabs: {
      connectHint: 'Double-click a host or right-click to connect',
    },
    // Welcome
    welcome: {
      subtitle: 'Modern SSH workspace for developers and teams',
      addFirstHost: 'Add your first host',
      hint: 'Or double-click any host in the sidebar to connect',
    },
    // Connection
    conn: {
      connecting: 'Connecting to',
      failed: 'Connection failed',
    },
    // AI
    ai: {
      toggle: 'AI',
      title: 'AI Assistant',
      placeholder: 'Ask a question… (Enter to send, Shift+Enter for newline)',
      send: 'Send',
      stop: 'Stop',
      clear: 'Clear',
      settings: 'Settings',
      empty: 'Ask anything about Linux, SSH,\ndatabases, or infrastructure',
      provider: 'Provider',
      ollamaLocal: 'Ollama (local)',
      openaiCompat: 'OpenAI-compatible',
      ollamaUrl: 'Ollama URL',
      model: 'Model',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      systemPrompt: 'System Prompt',
      save: 'Save',
      cancel: 'Cancel',
      aiSettings: 'AI Settings',
    },
    // Host modal
    host: {
      addTitle: 'Add Host',
      editTitle: 'Edit Host',
      name: 'Display Name',
      hostname: 'Hostname / IP',
      port: 'Port',
      username: 'Username',
      auth: 'Authentication',
      password: 'Password',
      privateKey: 'Private Key',
      sshAgent: 'SSH Agent',
      passwordLabel: 'Password',
      keyPath: 'Key Path',
      browse: 'Browse',
      passphrase: 'Passphrase',
      group: 'Group',
      none: 'None',
      jumpHost: 'Jump Host',
      notes: 'Notes',
      save: 'Save',
      cancel: 'Cancel',
      test: 'Test',
    },
    // Common
    common: {
      close: 'Close',
      delete: 'Delete',
      rename: 'Rename',
      copy: 'Copy',
      copied: 'Copied',
      connect: 'Connect (Terminal)',
      connectSftp: 'Connect (SFTP)',
      disconnect: 'Disconnect',
      edit: 'Edit',
    },
    // Window
    window: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      close: 'Close',
    },
    // About
    about: {
      title: 'About NexOps',
      version: 'Version',
      desc: 'Modern SSH workspace for developers and teams.',
      ok: 'OK',
    },
  },

  zh: {
    menu: {
      file: '文件',
      view: '视图',
      help: '帮助',
      newHost: '新建主机',
      newDbConn: '新建数据库连接',
      quit: '退出',
      toggleSidebar: '显示/隐藏侧边栏',
      toggleAi: '显示/隐藏 AI 面板',
      zoomIn: '放大',
      zoomOut: '缩小',
      resetZoom: '重置缩放',
      about: '关于 NexOps',
      docs: '文档',
      reportIssue: '反馈问题',
      language: '语言',
    },
    sidebar: {
      hosts: '主机',
      search: '搜索主机…',
      addHost: '添加主机',
      addGroup: '添加分组',
      batchOps: '批量运维',
      database: '数据库',
      noHosts: '暂无主机',
    },
    tabs: {
      connectHint: '双击主机或右键连接',
    },
    welcome: {
      subtitle: '面向开发者和团队的现代 SSH 工作台',
      addFirstHost: '添加第一台主机',
      hint: '或在侧边栏双击任意主机即可连接',
    },
    conn: {
      connecting: '正在连接',
      failed: '连接失败',
    },
    ai: {
      toggle: 'AI',
      title: 'AI 助手',
      placeholder: '提问… (Enter 发送，Shift+Enter 换行)',
      send: '发送',
      stop: '停止',
      clear: '清空',
      settings: '设置',
      empty: '询问 Linux、SSH、\n数据库或基础设施相关问题',
      provider: '服务商',
      ollamaLocal: 'Ollama（本地）',
      openaiCompat: 'OpenAI 兼容接口',
      ollamaUrl: 'Ollama 地址',
      model: '模型',
      baseUrl: '接口地址',
      apiKey: 'API 密钥',
      systemPrompt: '系统提示词',
      save: '保存',
      cancel: '取消',
      aiSettings: 'AI 设置',
    },
    host: {
      addTitle: '添加主机',
      editTitle: '编辑主机',
      name: '显示名称',
      hostname: '主机名 / IP',
      port: '端口',
      username: '用户名',
      auth: '认证方式',
      password: '密码',
      privateKey: '私钥',
      sshAgent: 'SSH Agent',
      passwordLabel: '密码',
      keyPath: '密钥路径',
      browse: '浏览',
      passphrase: '私钥密码',
      group: '分组',
      none: '无',
      jumpHost: '跳板机',
      notes: '备注',
      save: '保存',
      cancel: '取消',
      test: '测试',
    },
    common: {
      close: '关闭',
      delete: '删除',
      rename: '重命名',
      copy: '复制',
      copied: '已复制',
      connect: '连接（终端）',
      connectSftp: '连接（SFTP）',
      disconnect: '断开连接',
      edit: '编辑',
    },
    window: {
      minimize: '最小化',
      maximize: '最大化',
      restore: '还原',
      close: '关闭',
    },
    about: {
      title: '关于 NexOps',
      version: '版本',
      desc: '面向开发者和团队的现代 SSH 工作台。',
      ok: '确定',
    },
  },
} as const

export type Translations = typeof translations.en

// ─── Context ──────────────────────────────────────────────────────────────────

import React from 'react'

interface I18nCtx {
  locale: Locale
  t: Translations
  setLocale: (l: Locale) => void
}

export const I18nContext = createContext<I18nCtx>({
  locale: 'en',
  t: translations.en,
  setLocale: () => {},
})

export function useI18n() {
  return useContext(I18nContext)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
    return navigator.language.startsWith('zh') ? 'zh' : 'en'
  })

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, t: translations[locale], setLocale } },
    children
  )
}
