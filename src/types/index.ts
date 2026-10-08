// ViewId has a single source of truth in the app store, which is what the
// router in src/app/page.tsx keys off. This module previously declared a
// second, narrower copy, so the sidebar and the router disagreed about which
// views exist and the academic/HRM screens were unreachable.
export type { ViewId } from '@/stores/app-store';

// ─── Dashboard Stats ────────────────────────────────────────────────────────────
export interface PlatformStat {
  platform: string;
  followers: number;
  engagement: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  time: string;
  platform?: string;
}

export interface WeeklyDataPoint {
  day: string;
  engagement: number;
  reach: number;
}

export interface DashboardStats {
  totalFollowers: number;
  followerGrowth: number;
  totalEngagement: number;
  engagementGrowth: number;
  totalReach: number;
  reachGrowth: number;
  totalMessages: number;
  messageGrowth: number;
  totalLeads: number;
  leadGrowth: number;
  scheduledPosts: number;
  activeCampaigns: number;
  activeAgents: number;
  connectedPlatforms: number;
  totalPlatforms: number;
  platformStats: PlatformStat[];
  recentActivity: ActivityItem[];
  weeklyData: WeeklyDataPoint[];
}
