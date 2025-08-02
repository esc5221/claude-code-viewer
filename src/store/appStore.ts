import { create } from 'zustand'
import { Project, Session, Message, Tab, AppState } from '@/types'

interface AppStore extends AppState {
  // Recent sessions cache
  recentSessionsCache: { data: any[] | null; timestamp: number | null }
  setRecentSessionsCache: (data: any[]) => void
  getRecentSessionsCache: () => { data: any[] | null; isValid: boolean }
  
  // Actions
  setProjects: (projects: Project[]) => void
  selectProject: (path: string | null) => void
  setSessions: (sessions: Session[]) => void
  setSessionsForProject: (projectPath: string, sessions: Session[]) => void
  selectSession: (id: string | null) => void
  setMessages: (sessionId: string, messages: Message[]) => void
  appendMessage: (sessionId: string, message: Message) => void
  
  // Session loading
  loadSessionsForProject: (projectPath: string) => Promise<void>
  
  // Tab actions
  createSessionTab: (sessionId: string, projectPath: string, sessionName?: string) => void
  createDashboardTab: () => void
  createProjectTab: (projectPath: string) => void
  addTab: (session: Session, project: Project) => void  // Keep for backward compatibility
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => Promise<void>
  ensureDashboardTab: () => void
  
  // UI actions
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  projects: [],
  selectedProjectPath: null,
  sessions: [],
  sessionsByProject: {},
  selectedSessionId: null,
  tabs: [],
  activeTabId: null,
  messages: {},
  sidebarCollapsed: false,
  sidebarWidth: parseInt(localStorage.getItem('sidebarWidth') || '280'),
  theme: 'light',
  
  // Recent sessions cache
  recentSessionsCache: { data: null, timestamp: null },
  
  // Actions
  setProjects: (projects) => set({ projects }),
  
  selectProject: (path) => set({ selectedProjectPath: path, sessions: [], selectedSessionId: null }),
  
  setSessions: (sessions) => set({ sessions }),
  
  setSessionsForProject: (projectPath, sessions) =>
    set((state) => ({
      sessionsByProject: {
        ...state.sessionsByProject,
        [projectPath]: sessions
      }
    })),
  
  selectSession: (id) => set({ selectedSessionId: id }),
  
  setMessages: (sessionId, messages) => 
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages }
    })),
  
  appendMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message]
      }
    })),
  
  // Load sessions for a project if not already loaded
  loadSessionsForProject: async (projectPath) => {
    const state = useAppStore.getState()
    
    // Find the project to get the correct Claude folder path for API calls
    const project = state.projects.find(p => p.name === projectPath || p.path === projectPath)
    if (!project) {
      console.error('[Store] Project not found for path:', projectPath)
      return
    }
    
    // Use project.name (resolved real path) as the key for sessionsByProject
    const sessionKey = project.name
    const apiPath = project.path // Use Claude folder path for API calls
    
    const existingSessions = state.sessionsByProject[sessionKey]
    
    // Skip if sessions are already loaded and not empty, or if currently loading
    if (existingSessions && existingSessions.length > 0) {
      console.log('[Store] Sessions already cached for project:', sessionKey)
      return
    }
    
    try {
      console.log('[Store] Loading sessions for project:', sessionKey, 'using API path:', apiPath)
      
      // Check if window.api exists and has the required method
      if (window.api && window.api.getSessions) {
        const sessions = await window.api.getSessions(apiPath)
        console.log(`[Store] Loaded ${sessions.length} sessions for project:`, sessionKey)
        state.setSessionsForProject(sessionKey, sessions)
      } else {
        console.warn('[Store] window.api.getSessions not available')
      }
    } catch (error) {
      console.error('Failed to load sessions for project:', sessionKey, error)
      // Set empty array to indicate we tried loading but failed
      state.setSessionsForProject(sessionKey, [])
    }
  },
  
  // Tab creation methods
  createSessionTab: (sessionId, projectPath, sessionName) =>
    set((state) => {
      const tabId = sessionId // Use sessionId directly as tab ID
      const existingTab = state.tabs.find(t => t.id === tabId)
      
      if (existingTab) {
        return { activeTabId: tabId }
      }
      
      // Find the project to ensure we use the correct real path
      const project = state.projects.find(p => p.name === projectPath || p.path === projectPath)
      const realProjectPath = project ? project.name : projectPath
      
      return {
        tabs: [...state.tabs, {
          id: tabId,
          type: 'session',
          sessionId,
          projectPath: realProjectPath, // Always use real path for consistency
          sessionName: sessionName || sessionId.substring(0, 8)
        }],
        activeTabId: tabId
      }
    }),

  createDashboardTab: () =>
    set((state) => {
      const tabId = 'dashboard'
      const existingTab = state.tabs.find(t => t.id === tabId)
      
      if (existingTab) {
        return { activeTabId: tabId }
      }
      
      return {
        tabs: [...state.tabs, {
          id: tabId,
          type: 'dashboard',
          projectPath: '' // Dashboard doesn't belong to a specific project
        }],
        activeTabId: tabId
      }
    }),

  createProjectTab: (projectPath) =>
    set((state) => {
      // Find the project to ensure we use the correct real path
      const project = state.projects.find(p => p.name === projectPath || p.path === projectPath)
      const realProjectPath = project ? project.name : projectPath
      
      const tabId = `project-${realProjectPath.split('/').pop() || 'unknown'}-${Date.now()}`
      const existingTab = state.tabs.find(t => t.id === tabId)
      
      if (existingTab) {
        return { activeTabId: tabId }
      }
      
      return {
        tabs: [...state.tabs, {
          id: tabId,
          type: 'project',
          projectPath: realProjectPath // Always use real path for consistency
        }],
        activeTabId: tabId
      }
    }),

  ensureDashboardTab: () => {
    const state = get()
    const dashboardTab = state.tabs.find(t => t.type === 'dashboard')
    
    if (!dashboardTab) {
      // Create dashboard tab
      set((state) => ({
        tabs: [...state.tabs, {
          id: 'dashboard',
          type: 'dashboard',
          projectPath: ''
        }],
        activeTabId: 'dashboard'
      }))
    } else {
      // Switch to existing dashboard tab
      set({ activeTabId: dashboardTab.id })
    }
  },
  
  // Keep legacy addTab for backward compatibility
  addTab: (session, project) =>
    set((state) => {
      const tabId = session.id // Use sessionId directly
      const existingTab = state.tabs.find(t => t.id === tabId)
      
      if (existingTab) {
        return { activeTabId: tabId }
      }
      
      return {
        tabs: [...state.tabs, {
          id: tabId,
          type: 'session',
          sessionId: session.id,
          projectPath: project.name,  // Use project.name which is the resolved path
          sessionName: session.id.substring(0, 8)
        }],
        activeTabId: tabId
      }
    }),
  
  removeTab: (tabId) =>
    set((state) => {
      console.log('[removeTab] Called with tabId:', tabId)
      console.log('[removeTab] Current tabs:', state.tabs.map(t => ({ id: t.id, type: t.type })))
      console.log('[removeTab] Current activeTabId:', state.activeTabId)
      
      const tabs = state.tabs.filter(t => t.id !== tabId)
      let activeTabId = state.activeTabId
      
      console.log('[removeTab] Filtered tabs:', tabs.map(t => ({ id: t.id, type: t.type })))
      
      if (activeTabId === tabId) {
        const removedIndex = state.tabs.findIndex(t => t.id === tabId)
        console.log('[removeTab] Removed tab was active, removedIndex:', removedIndex)
        if (tabs.length > 0) {
          activeTabId = tabs[Math.min(removedIndex, tabs.length - 1)].id
          console.log('[removeTab] New activeTabId:', activeTabId)
        } else {
          activeTabId = null
          console.log('[removeTab] No tabs left, setting activeTabId to null')
        }
      }
      
      console.log('[removeTab] Final result - tabs count:', tabs.length, 'activeTabId:', activeTabId)
      return { tabs, activeTabId }
    }),
  
  setActiveTab: async (tabId) => {
    const state = useAppStore.getState()
    
    // Handle special cases where tabId is a direct command
    if (tabId === 'dashboard') {
      state.ensureDashboardTab()
      return
    }
    
    const tab = state.tabs.find(t => t.id === tabId)
    
    if (!tab) {
      console.warn(`Tab with id '${tabId}' not found`)
      return
    }
    
    if (tab.type === 'session') {
      // Ensure sessions are loaded for this project before switching
      await state.loadSessionsForProject(tab.projectPath)
    } else if (tab.type === 'project') {
      // Ensure sessions are loaded for project tabs
      await state.loadSessionsForProject(tab.projectPath)
    }
    
    set({ activeTabId: tabId })
  },
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setSidebarWidth: (width) => {
    localStorage.setItem('sidebarWidth', width.toString())
    set({ sidebarWidth: width })
  },
  
  setTheme: (theme) => set({ theme }),
  
  // Recent sessions cache methods
  setRecentSessionsCache: (data) => 
    set({ recentSessionsCache: { data, timestamp: Date.now() } }),
  
  getRecentSessionsCache: () => {
    const { recentSessionsCache } = get()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    const isValid = recentSessionsCache.data !== null && 
                   recentSessionsCache.timestamp !== null &&
                   Date.now() - recentSessionsCache.timestamp < CACHE_DURATION
    
    return { data: recentSessionsCache.data, isValid }
  }
}))