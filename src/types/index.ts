// ViewId has a single source of truth in the app store, which is what the
// router in src/app/page.tsx keys off. This module previously declared a
// second, narrower copy, so the sidebar and the router disagreed about which
// views exist and the academic/HRM screens were unreachable.
export type { ViewId } from '@/stores/app-store';
