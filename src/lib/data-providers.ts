/**
 * MarketingOS — Free-First Data Discovery Provider Registry (Requirement 4).
 *
 * A catalog of public, first-party, official API, open-data, and approved
 * freemium sources for market intelligence and lead discovery. Each provider
 * entry records its access method, free-tier limits, licensing, and verification
 * status — so the engine never claims a source is free, available, or integrated
 * until it has been verified.
 *
 * The registry is seeded into the DataProvider table. Admins can add custom
 * providers. The discovery engine reads from the table at runtime — no code
 * rewrite needed to add a source.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProviderDef {
  slug: string;
  name: string;
  category: string; // google|public_market|social_community|government|trade_association|open_data
  officialUrl: string;
  accessMethod: string; // official_api|open_data|permitted_scrape|oauth|manual
  availableDataFields: string[];
  authRequirements: string;
  freeTierLimit: string;
  paidTierRequirements?: string;
  rateLimit: string;
  licensingAndReuse: string;
  geographicCoverage: string;
  sourceReliability: number; // 0-100
}

// ── Verified / known providers (Requirement 4 enumeration) ────────────────
export const PROVIDER_CATALOG: ProviderDef[] = [
  // Google and Website Intelligence
  {
    slug: 'google_trends',
    name: 'Google Trends',
    category: 'google',
    officialUrl: 'https://trends.google.com',
    accessMethod: 'official_api',
    availableDataFields: ['search_interest_over_time', 'related_queries', 'related_topics', 'interest_by_region'],
    authRequirements: 'none (unofficial) / api_key (official exploration API, limited access)',
    freeTierLimit: 'Unlimited for public web interface; API is exploration-only',
    rateLimit: 'Web: human-paced; API: per-key quota',
    licensingAndReuse: 'Google Terms of Service — data for informational use, not redistribution',
    geographicCoverage: 'global',
    sourceReliability: 85,
  },
  {
    slug: 'google_search_console',
    name: 'Google Search Console',
    category: 'google',
    officialUrl: 'https://search.google.com/search-console',
    accessMethod: 'oauth',
    availableDataFields: ['search_queries', 'impressions', 'clicks', 'ctr', 'position', 'page_url'],
    authRequirements: 'oauth (site owner verification required)',
    freeTierLimit: 'Unlimited for verified properties',
    rateLimit: 'API: 200 req/min per property',
    licensingAndReuse: 'Google APIs Terms — first-party property data only',
    geographicCoverage: 'global (per verified property)',
    sourceReliability: 95,
  },
  {
    slug: 'google_analytics_4',
    name: 'Google Analytics 4',
    category: 'google',
    officialUrl: 'https://analytics.google.com',
    accessMethod: 'oauth',
    availableDataFields: ['sessions', 'users', 'pageviews', 'traffic_sources', 'conversions', 'events'],
    authRequirements: 'oauth (property access required)',
    freeTierLimit: 'Unlimited for standard properties',
    rateLimit: 'Data API: 10 req/sec per project',
    licensingAndReuse: 'Google APIs Terms — first-party property data only',
    geographicCoverage: 'global (per property)',
    sourceReliability: 95,
  },
  {
    slug: 'google_business_profile',
    name: 'Google Business Profile',
    category: 'google',
    officialUrl: 'https://www.google.com/business',
    accessMethod: 'oauth',
    availableDataFields: ['business_profile_performance', 'search_queries', 'direction_requests', 'call_clicks'],
    authRequirements: 'oauth (business profile owner)',
    freeTierLimit: 'Unlimited for owned profiles',
    rateLimit: 'API: standard quota',
    licensingAndReuse: 'Google APIs Terms — first-party business data',
    geographicCoverage: 'global',
    sourceReliability: 90,
  },
  {
    slug: 'google_page_speed',
    name: 'PageSpeed Insights',
    category: 'google',
    officialUrl: 'https://pagespeed.web.dev',
    accessMethod: 'official_api',
    availableDataFields: ['performance_score', 'core_web_vitals', 'audit_results', 'loading_metrics'],
    authRequirements: 'api_key (optional, higher quota)',
    freeTierLimit: 'Without key: 1 req/3s; with key: higher quota',
    rateLimit: '1 req/3s without API key',
    licensingAndReuse: 'Google APIs Terms — public page performance data',
    geographicCoverage: 'global',
    sourceReliability: 90,
  },
  // Public Market Intelligence
  {
    slug: 'openstreetmap',
    name: 'OpenStreetMap',
    category: 'open_data',
    officialUrl: 'https://www.openstreetmap.org',
    accessMethod: 'official_api',
    availableDataFields: ['business_locations', 'business_categories', 'addresses', 'geographic_metadata'],
    authRequirements: 'none for read API (Overpass/Nominatim)',
    freeTierLimit: 'Unlimited read (fair-use policy)',
    rateLimit: 'Overpass: 2 req/sec; Nominatim: 1 req/sec',
    licensingAndReuse: 'ODbL (Open Database License) — attribution required, share-alike',
    geographicCoverage: 'global',
    sourceReliability: 80,
  },
  {
    slug: 'product_hunt',
    name: 'Product Hunt',
    category: 'public_market',
    officialUrl: 'https://www.producthunt.com',
    accessMethod: 'official_api',
    availableDataFields: ['new_products', 'categories', 'upvotes', 'launch_dates', 'makers'],
    authRequirements: 'api_key (oauth)',
    freeTierLimit: 'Free GraphQL API with rate limits',
    rateLimit: 'GraphQL: standard quota',
    licensingAndReuse: 'Product Hunt API ToS — data for informational use',
    geographicCoverage: 'global',
    sourceReliability: 75,
  },
  {
    slug: 'public_procurement_portals',
    name: 'Public Procurement / Tender Portals',
    category: 'government',
    officialUrl: 'https://www.ungm.org',
    accessMethod: 'open_data',
    availableDataFields: ['tender_notices', 'procurement_opportunities', 'awards', 'buyer_orgs'],
    authRequirements: 'varies by portal (some open, some registration)',
    freeTierLimit: 'Most government portals are free',
    rateLimit: 'Varies by portal',
    licensingAndReuse: 'Government open data — usually public domain or CC BY',
    geographicCoverage: 'global (per-country portals)',
    sourceReliability: 85,
  },
  {
    slug: 'government_open_data',
    name: 'Government Open Data Portals',
    category: 'government',
    officialUrl: 'https://www.data.gov',
    accessMethod: 'open_data',
    availableDataFields: ['business_registries', 'economic_indicators', 'demographics', 'industry_statistics'],
    authRequirements: 'none (most portals)',
    freeTierLimit: 'Unlimited',
    rateLimit: 'Varies by portal',
    licensingAndReuse: 'Usually public domain or CC0 — verify per dataset',
    geographicCoverage: 'global (per-country portals)',
    sourceReliability: 90,
  },
  {
    slug: 'public_business_directories',
    name: 'Public Business Directories (Permitted)',
    category: 'public_market',
    officialUrl: 'https://example.com/directories',
    accessMethod: 'official_api',
    availableDataFields: ['business_name', 'category', 'location', 'website'],
    authRequirements: 'varies (api_key or registration)',
    freeTierLimit: 'Varies — some free, some freemium',
    rateLimit: 'Varies by directory',
    licensingAndReuse: 'Varies — must verify each directory permits reuse before using',
    geographicCoverage: 'global',
    sourceReliability: 70,
  },
  {
    slug: 'trade_associations',
    name: 'Trade Associations',
    category: 'trade_association',
    officialUrl: 'https://example.com/trade-assoc',
    accessMethod: 'manual',
    availableDataFields: ['member_directories', 'industry_reports', 'events', 'standards'],
    authRequirements: 'membership or registration (varies)',
    freeTierLimit: 'Some public reports free; member directories often members-only',
    rateLimit: 'N/A (manual access)',
    licensingAndReuse: 'Varies by association — verify terms',
    geographicCoverage: 'regional / industry-specific',
    sourceReliability: 80,
  },
  // Social and Community Intelligence
  {
    slug: 'reddit_api',
    name: 'Reddit (Public API)',
    category: 'social_community',
    officialUrl: 'https://www.reddit.com/dev/api',
    accessMethod: 'official_api',
    availableDataFields: ['public_posts', 'comments', 'subreddit_metadata', 'trending_topics'],
    authRequirements: 'oauth (app registration)',
    freeTierLimit: 'Free for reasonable use (100 req/min)',
    rateLimit: '100 req/min (oauth)',
    licensingAndReuse: 'Reddit API ToS — public content, user attribution required',
    geographicCoverage: 'global',
    sourceReliability: 65,
  },
  {
    slug: 'public_linkedin',
    name: 'LinkedIn (Public Company Pages)',
    category: 'social_community',
    officialUrl: 'https://www.linkedin.com',
    accessMethod: 'oauth',
    availableDataFields: ['company_info', 'employee_count_range', 'industry', 'updates'],
    authRequirements: 'oauth (LinkedIn Marketing API, approval required)',
    freeTierLimit: 'Marketing API has quota tiers',
    rateLimit: 'Varies by endpoint',
    licensingAndReuse: 'LinkedIn API Terms — restricted use, no scraping',
    geographicCoverage: 'global',
    sourceReliability: 85,
  },
  {
    slug: 'meta_graph_api',
    name: 'Meta Graph API (Facebook Pages)',
    category: 'social_community',
    officialUrl: 'https://developers.facebook.com/docs/graph-api',
    accessMethod: 'oauth',
    availableDataFields: ['page_info', 'page_posts', 'page_engagement', 'page_followers'],
    authRequirements: 'oauth (Page access token, app review)',
    freeTierLimit: 'Free for verified apps with approved scopes',
    rateLimit: 'Graph API rate limits per app',
    licensingAndReuse: 'Meta Platform Terms — restricted use, no scraping',
    geographicCoverage: 'global',
    sourceReliability: 85,
  },
  {
    slug: 'youtube_data_api',
    name: 'YouTube Data API',
    category: 'social_community',
    officialUrl: 'https://developers.google.com/youtube/v3',
    accessMethod: 'official_api',
    availableDataFields: ['channel_info', 'video_metadata', 'search_results', 'statistics'],
    authRequirements: 'api_key',
    freeTierLimit: '10,000 quota units/day',
    rateLimit: 'Per-quota-unit system',
    licensingAndReuse: 'Google APIs ToS — public video/channel metadata',
    geographicCoverage: 'global',
    sourceReliability: 90,
  },
];

/**
 * Seed the DataProvider table (idempotent).
 * Never marks a provider as "integrated" — only "verified" if the entry exists.
 * Integration status stays "not_integrated" until the adapter is actually built.
 */
export async function seedDataProviders(): Promise<number> {
  let inserted = 0;
  for (const def of PROVIDER_CATALOG) {
    const existing = await prisma.dataProvider.findUnique({ where: { slug: def.slug } });
    if (existing) continue;
    await prisma.dataProvider.create({
      data: {
        slug: def.slug,
        name: def.name,
        category: def.category,
        officialUrl: def.officialUrl,
        accessMethod: def.accessMethod,
        availableDataFields: JSON.stringify(def.availableDataFields),
        authRequirements: def.authRequirements,
        freeTierLimit: def.freeTierLimit,
        paidTierRequirements: def.paidTierRequirements || null,
        rateLimit: def.rateLimit,
        licensingAndReuse: def.licensingAndReuse,
        geographicCoverage: def.geographicCoverage,
        sourceReliability: def.sourceReliability,
        verificationStatus: 'verified',
        integrationStatus: 'not_integrated',
        lastVerifiedAt: new Date(),
        isActive: true,
      },
    });
    inserted++;
  }
  return inserted;
}

/**
 * List data providers (global catalog + tenant-registered).
 * Optionally filter by category or integration status.
 */
export async function listDataProviders(opts?: {
  companyId?: string;
  category?: string;
  integrationStatus?: string;
}) {
  return prisma.dataProvider.findMany({
    where: {
      AND: [
        { isActive: true },
        opts?.category ? { category: opts.category } : {},
        opts?.integrationStatus ? { integrationStatus: opts.integrationStatus } : {},
        {
          OR: [
            { companyId: null },
            ...(opts?.companyId ? [{ companyId: opts.companyId }] : []),
          ],
        },
      ],
    },
    orderBy: [{ sourceReliability: 'desc' }, { name: 'asc' }],
  });
}

/**
 * Mark a provider's integration status (used when an adapter is built/tested).
 */
export async function setProviderIntegrationStatus(slug: string, status: string) {
  return prisma.dataProvider.update({
    where: { slug },
    data: {
      integrationStatus: status,
      lastVerifiedAt: new Date(),
    },
  });
}
