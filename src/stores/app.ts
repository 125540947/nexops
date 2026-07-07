import { create } from 'zustand'
import type { Host, HostGroup, DbConnection } from '../../shared/types'

export type TabType = 'terminal' | 'sftp' | 'batch' | 'db'

export interface Tab {
  id: string
  hostId: number
  hostName: string
  hostLabel: string
  type: TabType
  sessionId: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  errorMsg?: string
}

interface AppState {
  // Data
  hosts: Host[]
  groups: HostGroup[]
  dbConnections: DbConnection[]
  tabs: Tab[]
  activeTabId: string | null

  // UI state
  sidebarWidth: number
  searchQuery: string

  // Actions
  setHosts: (hosts: Host[]) => void
  addHost: (host: Host) => void
  updateHost: (host: Host) => void
  removeHost: (id: number) => void

  setGroups: (groups: HostGroup[]) => void
  addGroup: (group: HostGroup) => void
  removeGroup: (id: number) => void

  setDbConnections: (dbs: DbConnection[]) => void
  addDbConnection: (db: DbConnection) => void
  removeDbConnection: (id: number) => void

  openTab: (tab: Tab) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabStatus: (tabId: string, status: Tab['status'], errorMsg?: string) => void

  setSidebarWidth: (w: number) => void
  setSearchQuery: (q: string) => void

  // AI panel
  aiPanelOpen: boolean
  toggleAiPanel: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  hosts: [],
  groups: [],
  dbConnections: [],
  tabs: [],
  activeTabId: null,
  sidebarWidth: 240,
  searchQuery: '',
  aiPanelOpen: false,

  setHosts: (hosts) => set({ hosts }),
  addHost: (host) => set((s) => ({ hosts: [...s.hosts, host] })),
  updateHost: (host) =>
    set((s) => ({ hosts: s.hosts.map((h) => (h.id === host.id ? host : h)) })),
  removeHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id) })),

  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  setDbConnections: (dbConnections) => set({ dbConnections }),
  addDbConnection: (db) => set((s) => ({ dbConnections: [...s.dbConnections, db] })),
  removeDbConnection: (id) => set((s) => ({ dbConnections: s.dbConnections.filter((d) => d.id !== id) })),

  openTab: (tab) => {
    const exists = get().tabs.find((t) => t.id === tab.id)
    if (exists) {
      set({ activeTabId: tab.id })
      return
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  closeTab: (tabId) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== tabId)
      const activeTabId =
        s.activeTabId === tabId
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : s.activeTabId
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabStatus: (tabId, status, errorMsg) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, status, errorMsg } : t))
    })),

  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen }))
}))
