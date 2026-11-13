import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'workforce'
  | 'integrations'
  | 'social-accounts'
  | 'ai-command'
  | 'media-studio'
  | 'crm'
  | 'seo'
  | 'campaigns'
  | 'content'
  | 'analytics'
  | 'team'
  | 'messages'
  | 'announcements'
  | 'audit-logs'
  | 'subscriptions'
  | 'settings'
  | 'ai-agents'
  | 'ai-models'
  | 'voice-agents'
  | 'calls'
  | 'voice-studio'
  | 'contact-center'
  | 'billing-voice'
  | 'growth-engine';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  companyId: string;
  companyName: string;
  plan: string;
  token: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface AppState {
  // Auth
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  currentCompany: Company | null;

  // Navigation
  activeView: ViewId;

  // Actions
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setActiveView: (view: ViewId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isSidebarOpen: true,
  currentCompany: null,
  activeView: 'dashboard',

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false,
    currentCompany: user ? { id: (user as any).companyId || '', name: (user as any).companyName || '', slug: '' } : null,
  }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mos_token');
    }
    set({ user: null, isAuthenticated: false, isLoading: false, activeView: 'dashboard', currentCompany: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setActiveView: (activeView) => set({ activeView }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
}));
