/**
 * MarketingOS — MerlinStacks Service Adapters (Requirement: integrate 4 repos).
 *
 * Adapters for connecting to self-hosted instances of the 4 MerlinStacks
 * open-source services:
 *
 *   1. socaliseit  — Social media management + Remotion video editing.
 *                     Next.js app with MCP + REST API.
 *                     Repo: https://github.com/MerlinStacks/socaliseit
 *
 *   2. overseek    — WooCommerce operations hub (analytics, inventory, orders,
 *                     customer intelligence). Next.js + Fastify with MCP + REST.
 *                     Repo: https://github.com/MerlinStacks/overseek
 *
 *   3. personaliseit — WooCommerce product personalization plugin (live canvas,
 *                     print production). WordPress plugin with REST API.
 *                     Repo: https://github.com/MerlinStacks/personaliseit
 *
 *   4. true-video-product-gallery — WooCommerce video-capable product gallery.
 *                     WordPress plugin with REST API.
 *                     Repo: https://github.com/MerlinStacks/true-video-product-gallery
 *
 * Each adapter reads the connection config (baseUrl + apiKey) from the
 * ExternalServiceConnection table. Adapters are defensive — they return
 * structured errors rather than throwing, so a down/misconfigured service
 * never crashes the platform.
 */
import { PrismaClient } from '@prisma/client';
import { isUrlSafe } from './ssrf';
const prisma = new PrismaClient();

// ── Service catalog ────────────────────────────────────────────────────────
export interface MerlinStacksService {
  slug: string;
  name: string;
  description: string;
  repoUrl: string;
  techStack: string;
  capabilities: string[];
  defaultPort?: number;
  apiPath: string;
}

export const MERLINSTACKS_SERVICES: MerlinStacksService[] = [
  {
    slug: 'socaliseit',
    name: 'SocaliseIt',
    description: 'Social media management platform with multi-track video editing (Remotion), unified publishing across Instagram, TikTok, YouTube, Facebook, Pinterest, Bluesky & more. AI content engine, drag-and-drop calendar, cross-channel analytics.',
    repoUrl: 'https://github.com/MerlinStacks/socaliseit',
    techStack: 'Next.js 15 + React 19 + PostgreSQL + Prisma + Redis + BullMQ + NextAuth + Remotion',
    capabilities: [
      'multi_platform_publishing',
      'video_editing_remotion',
      'content_calendar',
      'ai_content_generation',
      'cross_channel_analytics',
      'social_inbox',
      'mcp_integration',
    ],
    apiPath: '/api/v1',
  },
  {
    slug: 'overseek',
    name: 'Overseek',
    description: 'Self-hosted WooCommerce operations hub: analytics, automation, inventory, order management, customer intelligence, email marketing, SEO, ads management. Drag-and-drop dashboard with real-time tracking.',
    repoUrl: 'https://github.com/MerlinStacks/overseek',
    techStack: 'React 19 + Vite 7 + Fastify 5 + Prisma 7 + PostgreSQL 17 (pgvector) + Elasticsearch 9 + Redis + BullMQ',
    capabilities: [
      'woocommerce_order_sync',
      'inventory_management',
      'customer_intelligence',
      'analytics_dashboard',
      'email_marketing',
      'seo_keyword_tracking',
      'paid_ads_management',
      'abandoned_cart_recovery',
      'mcp_integration',
    ],
    apiPath: '/api/v1',
  },
  {
    slug: 'personaliseit',
    name: 'PersonaliseIt (OverCustomise)',
    description: 'WooCommerce product personalization plugin with live canvas editor (Fabric.js). Customers personalize products with text, images, clipart. Async print-file generation for engraving, UV, embroidery, sublimation.',
    repoUrl: 'https://github.com/MerlinStacks/personaliseit',
    techStack: 'WordPress 6.8+ + WooCommerce + Fabric.js + TCPDF + PHP 8+ + Composer',
    capabilities: [
      'live_canvas_editor',
      'text_image_personalization',
      'print_file_generation',
      'multiple_print_areas',
      'font_clipart_libraries',
      'variable_data_printing',
      'async_print_queue',
      'engraving_uv_embroidery_sublimation',
    ],
    apiPath: '/wp-json/overcustomise/v1',
  },
  {
    slug: 'true_video_product_gallery',
    name: 'True Video Product Gallery',
    description: 'WooCommerce plugin replacing the default product gallery with a video-capable slider. Supports YouTube, Vimeo, TikTok, Instagram Reels, and self-hosted videos. Lazy-loading facade for Core Web Vitals.',
    repoUrl: 'https://github.com/MerlinStacks/true-video-product-gallery',
    techStack: 'WordPress 6.4+ + WooCommerce 8.0+ + PHP 8.0+ + React admin + Swiper + Rollup',
    capabilities: [
      'multi_platform_video',
      'lazy_loading_facade',
      'per_variation_video',
      'custom_thumbnails',
      'gallery_auto_scroll',
      'shortcode_support',
      'rest_api_settings',
      'archive_hover_video',
    ],
    apiPath: '/wp-json/tvpg/v1',
  },
];

export function getService(slug: string): MerlinStacksService | undefined {
  return MERLINSTACKS_SERVICES.find(s => s.slug === slug);
}

// ── Connection management ──────────────────────────────────────────────────
export interface ConnectionConfig {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  metadata?: Record<string, any>;
}

/**
 * Get a connection for a service from the database.
 */
export async function getConnection(companyId: string, serviceSlug: string) {
  return prisma.externalServiceConnection.findUnique({
    where: { companyId_serviceSlug: { companyId, serviceSlug } },
  });
}

/**
 * List all connections for a company.
 */
export async function listConnections(companyId: string) {
  return prisma.externalServiceConnection.findMany({
    where: { companyId },
    orderBy: { serviceName: 'asc' },
  });
}

/**
 * Create or update a connection to a MerlinStacks service.
 */
export async function upsertConnection(
  companyId: string,
  serviceSlug: string,
  config: ConnectionConfig,
) {
  const service = getService(serviceSlug);
  if (!service) throw new Error(`Unknown service: ${serviceSlug}`);

  // SSRF guard
  if (!isUrlSafe(config.baseUrl)) {
    throw new Error('Base URL failed SSRF safety check.');
  }

  const existing = await prisma.externalServiceConnection.findUnique({
    where: { companyId_serviceSlug: { companyId, serviceSlug } },
  });

  if (existing) {
    return prisma.externalServiceConnection.update({
      where: { id: existing.id },
      data: {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || null,
        apiSecret: config.apiSecret || null,
        metadata: config.metadata ? JSON.stringify(config.metadata) : null,
        status: 'connected',
        updatedAt: new Date(),
      },
    });
  }

  return prisma.externalServiceConnection.create({
    data: {
      serviceSlug,
      serviceName: service.name,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey || null,
      apiSecret: config.apiSecret || null,
      capabilities: JSON.stringify(service.capabilities),
      metadata: config.metadata ? JSON.stringify(config.metadata) : null,
      status: 'connected',
      companyId,
    },
  });
}

/**
 * Remove a connection (disconnect).
 */
export async function removeConnection(companyId: string, serviceSlug: string) {
  return prisma.externalServiceConnection.deleteMany({
    where: { companyId, serviceSlug },
  });
}

/**
 * Update sync status after a sync operation.
 */
async function updateSyncStatus(
  connectionId: string,
  status: 'success' | 'partial' | 'failed',
  error?: string,
) {
  return prisma.externalServiceConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: error || null,
      syncCount: { increment: 1 },
    },
  });
}

// ── HTTP helper ────────────────────────────────────────────────────────────
interface ApiResponse {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

async function callService(
  connection: { baseUrl: string; apiKey: string | null; apiPath: string },
  method: string,
  path: string,
  body?: any,
): Promise<ApiResponse> {
  const url = `${connection.baseUrl}${connection.apiPath}${path}`;
  if (!isUrlSafe(url)) {
    return { ok: false, status: 0, error: 'URL failed SSRF safety check' };
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 204) return { ok: true, status: 204 };

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.message || data?.error || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || 'Network error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SocaliseIt Adapter — Social media management + video editing
// ═══════════════════════════════════════════════════════════════════════════
export const socaliseitAdapter = {
  /** Test connection by fetching the service health/status endpoint */
  async testConnection(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    const res = await callService({ ...conn, apiPath: service.apiPath }, 'GET', '/health');
    await updateSyncStatus(conn.id, res.ok ? 'success' : 'failed', res.error);
    return res;
  },

  /** List connected social accounts from the socaliseit instance */
  async listSocialAccounts(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/social-accounts');
  },

  /** Publish content to one or more platforms */
  async publishContent(companyId: string, opts: {
    platforms: string[];
    content: { text: string; mediaUrls?: string[] };
    scheduledAt?: string;
  }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'POST', '/publish', opts);
  },

  /** Get cross-channel analytics */
  async getAnalytics(companyId: string, opts?: { from?: string; to?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    const qs = opts ? `?${new URLSearchParams({ from: opts.from || '', to: opts.to || '' }).toString()}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/analytics${qs}`);
  },

  /** Get the content calendar */
  async getCalendar(companyId: string, opts?: { month?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    const qs = opts?.month ? `?month=${opts.month}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/calendar${qs}`);
  },

  /** Get social inbox (comments, mentions, DMs) */
  async getInbox(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'socaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('socaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/inbox');
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Overseek Adapter — WooCommerce operations hub
// ═══════════════════════════════════════════════════════════════════════════
export const overseekAdapter = {
  async testConnection(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    const res = await callService({ ...conn, apiPath: service.apiPath }, 'GET', '/health');
    await updateSyncStatus(conn.id, res.ok ? 'success' : 'failed', res.error);
    return res;
  },

  /** Sync WooCommerce orders */
  async syncOrders(companyId: string, opts?: { since?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    const qs = opts?.since ? `?since=${opts.since}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'POST', `/orders/sync${qs}`);
  },

  /** Get order list */
  async listOrders(companyId: string, opts?: { status?: string; limit?: number }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/orders${qs}`);
  },

  /** Get inventory status */
  async getInventory(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/inventory');
  },

  /** Get analytics dashboard data (revenue, visitors, attribution) */
  async getDashboard(companyId: string, opts?: { from?: string; to?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    const params = new URLSearchParams();
    if (opts?.from) params.set('from', opts.from);
    if (opts?.to) params.set('to', opts.to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/dashboard${qs}`);
  },

  /** Get customer intelligence (segments, CLV, cohorts) */
  async getCustomers(companyId: string, opts?: { segment?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    const qs = opts?.segment ? `?segment=${opts.segment}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/customers${qs}`);
  },

  /** Get abandoned carts */
  async getAbandonedCarts(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'overseek');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('overseek')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/abandoned-carts');
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PersonaliseIt Adapter — Product personalization (WordPress plugin)
// ═══════════════════════════════════════════════════════════════════════════
export const personaliseitAdapter = {
  async testConnection(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    const res = await callService({ ...conn, apiPath: service.apiPath }, 'GET', '/status');
    await updateSyncStatus(conn.id, res.ok ? 'success' : 'failed', res.error);
    return res;
  },

  /** List personalizable products */
  async listProducts(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/products');
  },

  /** Get personalization config for a product (print areas, layers, fonts) */
  async getProductConfig(companyId: string, productId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/products/${productId}/config`);
  },

  /** Get print queue status */
  async getPrintQueue(companyId: string, opts?: { status?: string }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    const qs = opts?.status ? `?status=${opts.status}` : '';
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/print-queue${qs}`);
  },

  /** Get available fonts */
  async getFonts(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/fonts');
  },

  /** Get clipart library */
  async getClipart(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'personaliseit');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('personaliseit')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/clipart');
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// True Video Product Gallery Adapter (WordPress plugin)
// ═══════════════════════════════════════════════════════════════════════════
export const trueVideoGalleryAdapter = {
  async testConnection(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    const res = await callService({ ...conn, apiPath: service.apiPath }, 'GET', '/status');
    await updateSyncStatus(conn.id, res.ok ? 'success' : 'failed', res.error);
    return res;
  },

  /** Get gallery settings */
  async getSettings(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/settings');
  },

  /** Update gallery settings */
  async updateSettings(companyId: string, settings: Record<string, any>): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'POST', '/settings', settings);
  },

  /** Get video gallery for a specific product */
  async getProductGallery(companyId: string, productId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', `/products/${productId}/gallery`);
  },

  /** Assign a video to a product variation */
  async assignVideo(companyId: string, opts: {
    productId: string;
    variationId?: string;
    videoUrl: string;
    videoType: string; // youtube|vimeo|tiktok|instagram|self_hosted
    thumbnailUrl?: string;
  }): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'POST', '/videos/assign', opts);
  },

  /** List all products with video galleries */
  async listProductGalleries(companyId: string): Promise<ApiResponse> {
    const conn = await getConnection(companyId, 'true_video_product_gallery');
    if (!conn) return { ok: false, status: 0, error: 'No connection configured' };
    const service = getService('true_video_product_gallery')!;
    return callService({ ...conn, apiPath: service.apiPath }, 'GET', '/products/with-videos');
  },
};

// ── Unified adapter accessor ───────────────────────────────────────────────
export const adapters: Record<string, {
  testConnection: (companyId: string) => Promise<ApiResponse>;
  [key: string]: any;
}> = {
  socaliseit: socaliseitAdapter,
  overseek: overseekAdapter,
  personaliseit: personaliseitAdapter,
  true_video_product_gallery: trueVideoGalleryAdapter,
};

/**
 * Get a summary of all MerlinStacks connections for a company.
 */
export async function getConnectionSummary(companyId: string) {
  const connections = await listConnections(companyId);
  return MERLINSTACKS_SERVICES.map(service => {
    const conn = connections.find(c => c.serviceSlug === service.slug);
    return {
      slug: service.slug,
      name: service.name,
      description: service.description,
      repoUrl: service.repoUrl,
      techStack: service.techStack,
      capabilities: service.capabilities,
      connected: !!conn,
      status: conn?.status || 'disconnected',
      lastSyncAt: conn?.lastSyncAt || null,
      lastSyncStatus: conn?.lastSyncStatus || null,
      baseUrl: conn?.baseUrl || null,
    };
  });
}
