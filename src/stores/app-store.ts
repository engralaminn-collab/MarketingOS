import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'workforce'
  | 'integrations'
  | 'setup-bot'
  | 'social-accounts'
  | 'ai-command'
  | 'media-studio'
  | 'talking-head'
  | 'crm'
  | 'seo'
  | 'market-intelligence'
  | 'campaigns'
  | 'content'
  | 'feeds'
  | 'marketing-studio'
  | 'analytics'
  | 'team'
  | 'messages'
  | 'announcements'
  | 'audit-logs'
  | 'subscriptions'
  | 'settings'
  | 'ai-agents'
  | 'free-ai-hub'
  | 'knowledge-wiki'
  | 'outreach-hub'
  | 'workflow-studio'
  | 'ukvi-hub'
  | 'ecosystem'
  | 'agency-console'
  | 'deployments'
  // Academic & HRM. The views and API routes for these already existed but
  // were unreachable because they were never added to this union.
  | 'students'
  | 'employees'
  | 'departments'
  | 'programs'
  | 'attendance'
  | 'assignments'
  | 'exams'
  | 'schedule'
  | 'finance'
  | 'fees'
  | 'salary'
  | 'hrm'
  | 'leave'
  | 'partners';

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

/** Active institution for the Academic & HRM modules. */
export interface ActiveInstitution {
  id: string;
  name: string;
  shortName: string;
}

interface AppState {
  // Auth
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  setupLanguage: 'bn' | 'en';

  // Academic & HRM scope. Loaded from /api/institution once the user is
  // authenticated; the academic views read institution.id when creating records.
  institution: ActiveInstitution | null;

  // Navigation
  activeView: ViewId;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setSetupLanguage: (language: 'bn' | 'en') => void;
  setInstitution: (institution: ActiveInstitution | null) => void;
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
  setupLanguage: 'bn',
  institution: null,
  activeView: 'dashboard',

  setUser: (user) => set((state) => ({
    user, isAuthenticated: !!user, isLoading: false,
    // Clients begin with onboarding after sign-in; other roles keep their current view.
    activeView: user?.role === 'client_user' && !state.isAuthenticated ? 'setup-bot' : state.activeView,
  })),
  setSetupLanguage: (setupLanguage) => set({ setupLanguage }),
  setInstitution: (institution) => set({ institution }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mos_token');
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      institution: null,
      activeView: 'dashboard',
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setActiveView: (activeView) => set({ activeView }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
}));
