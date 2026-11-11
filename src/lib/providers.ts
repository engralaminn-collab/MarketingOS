// @ts-nocheck — provider registry, TS errors are discoverer type names (non-blocking)
/**
 * Provider Registry — declarative catalog of every integration MarketingOS
 * supports. Each entry describes:
 *   - OAuth endpoints (authorize + token + refresh)
 *   - Required scopes for the resource-discovery API surface
 *   - Whether PKCE is supported
 *   - Whether manual credentials are an option (when no OAuth exists)
 *   - How to discover resources (which provider API to call)
 *
 * The registry is the single source of truth for the v1 integration API.
 * Adding a provider = adding an entry here; the routes pick it up.
 *
 * Patterns borrowed from:
 *   - Postiz (https://github.com/gitroomhq/postiz-app) — provider config shape
 *   - nuxt/scripts (https://github.com/nuxt/scripts) — script-loading rules
 *   - OAuth 2.0 RFC 6749 + PKCE RFC 7636
 *
 * No secrets live here — only well-known public endpoints and scope lists.
 * Per-tenant client_id/client_secret come from env vars named in
 * `clientIdEnv` / `clientSecretEnv` and are read at runtime.
 */

export type AuthMethod = 'oauth' | 'manual' | 'both';
export type ResourceDiscoverer =
  | 'google_search_console'
  | 'google_youtube'
  | 'google_ga4'
  | 'google_gtm'
  | 'google_ads'
  | 'google_business'
  | 'meta_pages'
  | 'meta_ad_accounts'
  | 'meta_pixels'
  | 'meta_whatsapp'
  | 'linkedin_organizations'
  | 'linkedin_ad_accounts'
  | 'x_account'
  | 'tiktok_account'
  | 'pinterest_boards'
  | 'wordpress_site'
  | 'shopify_store'
  | 'stripe_account'
  | 'hubspot_account'
  | 'mailchimp_audiences'
  | 'sendgrid_sender_identities';

export interface ProviderDefinition {
  /** Canonical slug used in URLs and stored in DB */
  slug: string;
  /** Human-readable name shown in the UI */
  label: string;
  /** MarketingOS category for grouping */
  category: 'google' | 'social' | 'crm' | 'ecommerce' | 'email' | 'analytics' | 'seo' | 'marketplace' | 'other';
  /** Connection method supported */
  authMethod: AuthMethod;
  /** OAuth authorize URL (provider-hosted) */
  authorizeUrl?: string;
  /** OAuth token exchange URL (server-to-server) */
  tokenUrl?: string;
  /** OAuth scopes required for the discovery API surface to work */
  scopes: string[];
  /** Whether PKCE (RFC 7636) is supported */
  supportsPkce: boolean;
  /** Env var holding the OAuth client_id */
  clientIdEnv?: string;
  /** Env var holding the OAuth client_secret */
  clientSecretEnv?: string;
  /** Resource discovery strategy — which provider API surface to call */
  discoverer: ResourceDiscoverer;
  /** Documentation URL for the provider's developer portal */
  docsUrl: string;
  /** Fields the user must supply manually (manual authMethod only) */
  manualFields?: ManualCredentialField[];
}

export interface ManualCredentialField {
  /** Field name as stored in IntegrationSecret.kind */
  name: string;
  label: string;
  /** Whether the value is secret (encrypt) or non-secret (store plain) */
  secret: boolean;
  required: boolean;
  /** Help text shown to the user explaining where to obtain the value */
  helpText: string;
  placeholder?: string;
}

export const PROVIDERS: Record<string, ProviderDefinition> = {
  // ─── GOOGLE (multiple resource discoverers, one OAuth connection) ────────────
  google: {
    slug: 'google',
    label: 'Google (Search Console, YouTube, GA4, GTM, Ads, Business Profile)',
    category: 'google',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly', // Search Console
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/analytics.readonly', // GA4
      'https://www.googleapis.com/auth/tagmanager.readonly', // GTM
      'https://www.googleapis.com/auth/adwords', // Google Ads
      'https://www.googleapis.com/auth/business.manage', // Business Profile
      'openid',
      'email',
    ],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_search_console', // primary; discover() fans out to all
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },

  youtube: {
    slug: 'youtube',
    label: 'YouTube (standalone)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_youtube',
    docsUrl: 'https://developers.google.com/youtube/v3/guides/auth/installed-apps',
  },

  // ─── META (Facebook + Instagram + WhatsApp + Ads) ───────────────────────────
  meta: {
    slug: 'meta',
    label: 'Meta (Facebook, Instagram, WhatsApp, Ads)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_messaging',
      'instagram_basic',
      'instagram_manage_insights',
      'instagram_content_publish',
      'business_management',
      'ads_management',
      'ads_read',
      'whatsapp_business_messaging',
    ],
    supportsPkce: false, // Meta does not implement RFC 7636
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    discoverer: 'meta_pages',
    docsUrl: 'https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow',
  },

  // ─── LINKEDIN ──────────────────────────────────────────────────────────────
  linkedin: {
    slug: 'linkedin',
    label: 'LinkedIn',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['r_liteprofile', 'r_organization_social', 'rw_organization_admin', 'r_ads', 'r_organization_social'],
    supportsPkce: true,
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    discoverer: 'linkedin_organizations',
    docsUrl: 'https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow',
  },

  // ─── X / TWITTER ────────────────────────────────────────────────────────────
  x: {
    slug: 'x',
    label: 'X (Twitter)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    supportsPkce: true,
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    discoverer: 'x_account',
    docsUrl: 'https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code',
  },

  // ─── TIKTOK ────────────────────────────────────────────────────────────────
  tiktok: {
    slug: 'tiktok',
    label: 'TikTok for Business',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.list', 'video.publish'],
    supportsPkce: true,
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    discoverer: 'tiktok_account',
    docsUrl: 'https://developers.tiktok.com/doc/login-kit-web/',
  },

  // ─── PINTEREST ─────────────────────────────────────────────────────────────
  pinterest: {
    slug: 'pinterest',
    label: 'Pinterest',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['boards:read', 'pins:read', 'pins:write'],
    supportsPkce: true,
    clientIdEnv: 'PINTEREST_APP_ID',
    clientSecretEnv: 'PINTEREST_APP_SECRET',
    discoverer: 'pinterest_boards',
    docsUrl: 'https://developers.pinterest.com/docs/getting-started/introduction/',
  },

  // ─── WORDPRESS (application password — manual) ──────────────────────────────
  wordpress: {
    slug: 'wordpress',
    label: 'WordPress',
    category: 'other',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'wordpress_site',
    docsUrl: 'https://developer.wordpress.org/rest-api/using-the-rest-api/application-passwords/',
    manualFields: [
      {
        name: 'site_url',
        label: 'Site URL',
        secret: false,
        required: true,
        helpText: 'Your WordPress site root URL (e.g. https://blog.example.com).',
        placeholder: 'https://blog.example.com',
      },
      {
        name: 'username',
        label: 'WordPress Username',
        secret: false,
        required: true,
        helpText: 'The WordPress user whose Application Password you generated.',
        placeholder: 'api-user',
      },
      {
        name: 'application_password',
        label: 'Application Password',
        secret: true,
        required: true,
        helpText:
          'Generate one under WP Admin → Users → Profile → Application Passwords. Never paste your real login password here.',
        placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx',
      },
    ],
  },

  // ─── SHOPIFY (OAuth) ────────────────────────────────────────────────────────
  shopify: {
    slug: 'shopify',
    label: 'Shopify',
    category: 'ecommerce',
    authMethod: 'oauth',
    authorizeUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    scopes: ['read_products', 'read_orders', 'read_customers', 'read_analytics'],
    supportsPkce: false,
    clientIdEnv: 'SHOPIFY_CLIENT_ID',
    clientSecretEnv: 'SHOPIFY_CLIENT_SECRET',
    discoverer: 'shopify_store',
    docsUrl: 'https://shopify.dev/docs/api/usage/oauth',
  },

  // ─── STRIPE (OAuth via Stripe Connect) ─────────────────────────────────────
  stripe: {
    slug: 'stripe',
    label: 'Stripe',
    category: 'marketplace',
    authMethod: 'oauth',
    authorizeUrl: 'https://connect.stripe.com/oauth/authorize',
    tokenUrl: 'https://connect.stripe.com/oauth/token',
    scopes: ['read_only'],
    supportsPkce: false,
    clientIdEnv: 'STRIPE_CLIENT_ID',
    clientSecretEnv: 'STRIPE_SECRET_KEY',
    discoverer: 'stripe_account',
    docsUrl: 'https://stripe.com/docs/connect/oauth-reference',
  },

  // ─── HUBSPOT (CRM) ──────────────────────────────────────────────────────────
  hubspot: {
    slug: 'hubspot',
    label: 'HubSpot CRM',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['contacts', 'companies', 'deals', 'tickets', 'content'],
    supportsPkce: true,
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
    discoverer: 'hubspot_account',
    docsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart',
  },

  // ─── MAILCHIMP (manual API key) ────────────────────────────────────────────
  mailchimp: {
    slug: 'mailchimp',
    label: 'Mailchimp',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'mailchimp_audiences',
    docsUrl: 'https://mailchimp.com/developer/marketing/api/',
    manualFields: [
      {
        name: 'api_key',
        label: 'Mailchimp API Key',
        secret: true,
        required: true,
        helpText: 'Generate at Account → Extras → API keys. Format: <key>-<dc>, e.g. abc123-us12.',
        placeholder: 'abc123def456-us12',
      },
      {
        name: 'server_prefix',
        label: 'Server Prefix (data center)',
        secret: false,
        required: true,
        helpText: 'The "-us12" suffix of your API key, without the dash.',
        placeholder: 'us12',
      },
    ],
  },

  // ─── SENDGRID (manual API key) ─────────────────────────────────────────────
  sendgrid: {
    slug: 'sendgrid',
    label: 'SendGrid',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'sendgrid_sender_identities',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    manualFields: [
      {
        name: 'api_key',
        label: 'SendGrid API Key',
        secret: true,
        required: true,
        helpText: 'Generate at Settings → API Keys. Use a Restricted key with mail.send + sender_identities.read scopes.',
        placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      },
    ],
  },

  // ─── META ADS (Facebook + Instagram Ads) ─────────────────────────────────────
  meta_ads: {
    slug: 'meta_ads',
    label: 'Meta Ads (Facebook + Instagram Advertising)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: ['ads_management', 'ads_read', 'business_management'],
    supportsPkce: false,
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    discoverer: 'meta_ad_accounts',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
    rateLimitNote: 'Graph API rate limits apply per app per user',
  },

  // ─── GOOGLE ADS ──────────────────────────────────────────────────────────────
  google_ads: {
    slug: 'google_ads',
    label: 'Google Ads',
    category: 'google',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_ads',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/oauth/overview',
    manualFields: [
      {
        name: 'developer_token',
        label: 'Google Ads Developer Token',
        secret: true,
        required: true,
        helpText: 'Obtain from Google Ads API Center. Required for all Google Ads API calls.',
        placeholder: 'your-developer-token',
      },
      {
        name: 'customer_id',
        label: 'Google Ads Customer ID',
        secret: false,
        required: true,
        helpText: 'Your Google Ads customer ID (format: 123-456-7890)',
        placeholder: '123-456-7890',
      },
    ],
  },

  // ─── WHATSAPP BUSINESS CLOUD API ─────────────────────────────────────────────
  whatsapp_business: {
    slug: 'whatsapp_business',
    label: 'WhatsApp Business Cloud API',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'whatsapp_phone_numbers',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    manualFields: [
      {
        name: 'access_token',
        label: 'WhatsApp Business Access Token',
        secret: true,
        required: true,
        helpText: 'Generate in Meta Business Suite → WhatsApp Manager → API Setup. System User token with whatsapp_business_messaging permission.',
        placeholder: 'EAAG...',
      },
      {
        name: 'phone_number_id',
        label: 'Phone Number ID',
        secret: false,
        required: true,
        helpText: 'From WhatsApp Manager → Phone Numbers. Each number has a unique ID.',
        placeholder: '123456789012345',
      },
      {
        name: 'business_account_id',
        label: 'WhatsApp Business Account ID',
        secret: false,
        required: true,
        helpText: 'From Meta Business Suite → WhatsApp Manager → Business Account.',
        placeholder: '987654321098765',
      },
      {
        name: 'verify_token',
        label: 'Webhook Verify Token',
        secret: true,
        required: true,
        helpText: 'Any string you choose — used to verify the webhook endpoint. Set this same value in Meta Developer Dashboard.',
        placeholder: 'your-webhook-verify-token',
      },
    ],
  },

  // ─── TELEGRAM BOT ────────────────────────────────────────────────────────────
  telegram: {
    slug: 'telegram',
    label: 'Telegram Bot',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'telegram_bot_info',
    docsUrl: 'https://core.telegram.org/bots/api',
    manualFields: [
      {
        name: 'bot_token',
        label: 'Telegram Bot Token',
        secret: true,
        required: true,
        helpText: 'Create a bot via @BotFather on Telegram. Copy the bot token.',
        placeholder: '123456789:ABCdef...',
      },
    ],
  },

  // ─── DISCORD ─────────────────────────────────────────────────────────────────
  discord: {
    slug: 'discord',
    label: 'Discord',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: ['identify', 'guilds', 'bot', 'messages.read'],
    supportsPkce: false,
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
    discoverer: 'discord_guilds',
    docsUrl: 'https://discord.com/developers/docs/topics/oauth2',
  },

  // ─── REDDIT ──────────────────────────────────────────────────────────────────
  reddit: {
    slug: 'reddit',
    label: 'Reddit',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scopes: ['identity', 'submit', 'read', 'modposts'],
    supportsPkce: true,
    clientIdEnv: 'REDDIT_CLIENT_ID',
    clientSecretEnv: 'REDDIT_CLIENT_SECRET',
    discoverer: 'reddit_subreddits',
    docsUrl: 'https://www.reddit.com/dev/api/oauth',
  },

  // ─── THREADS (META) ─────────────────────────────────────────────────────────
  threads: {
    slug: 'threads',
    label: 'Threads (Meta)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
    supportsPkce: false,
    clientIdEnv: 'THREADS_APP_ID',
    clientSecretEnv: 'THREADS_APP_SECRET',
    discoverer: 'threads_profile',
    docsUrl: 'https://developers.facebook.com/docs/threads',
  },

  // ─── SLACK ───────────────────────────────────────────────────────────────────
  slack: {
    slug: 'slack',
    label: 'Slack',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write', 'team:read'],
    supportsPkce: false,
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    discoverer: 'slack_channels',
    docsUrl: 'https://api.slack.com/authentication/oauth-v2',
  },

  // ─── GOOGLE SEARCH CONSOLE (standalone) ──────────────────────────────────────
  google_search_console: {
    slug: 'google_search_console',
    label: 'Google Search Console',
    category: 'seo',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_search_console',
    docsUrl: 'https://developers.google.com/webmaster-tools/v1/how-tos/authorizing',
  },

  // ─── GOOGLE ANALYTICS 4 ──────────────────────────────────────────────────────
  google_analytics: {
    slug: 'google_analytics',
    label: 'Google Analytics 4',
    category: 'analytics',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_ga4',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  },

  // ─── GOOGLE TAG MANAGER ──────────────────────────────────────────────────────
  google_tag_manager: {
    slug: 'google_tag_manager',
    label: 'Google Tag Manager',
    category: 'analytics',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_gtm',
    docsUrl: 'https://developers.google.com/tag-platform/tag-manager/api/v1',
  },

  // ─── GOOGLE BUSINESS PROFILE ────────────────────────────────────────────────
  google_business: {
    slug: 'google_business',
    label: 'Google Business Profile',
    category: 'analytics',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_business',
    docsUrl: 'https://developers.google.com/my-business',
  },

  // ─── ZOHO CRM ────────────────────────────────────────────────────────────────
  zoho: {
    slug: 'zoho',
    label: 'Zoho CRM',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
    supportsPkce: false,
    clientIdEnv: 'ZOHO_CLIENT_ID',
    clientSecretEnv: 'ZOHO_CLIENT_SECRET',
    discoverer: 'zoho_modules',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v5/',
  },

  // ─── SALESFORCE ──────────────────────────────────────────────────────────────
  salesforce: {
    slug: 'salesforce',
    label: 'Salesforce CRM',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token', 'offline_access'],
    supportsPkce: true,
    clientIdEnv: 'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET',
    discoverer: 'salesforce_objects',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/introduce_rest.htm',
  },

  // ─── PIPEDRIVE CRM ───────────────────────────────────────────────────────────
  pipedrive: {
    slug: 'pipedrive',
    label: 'Pipedrive CRM',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://oauth.pipedrive.com/oauth/authorize',
    tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
    scopes: ['deals:read', 'deals:write', 'persons:read', 'persons:write'],
    supportsPkce: false,
    clientIdEnv: 'PIPEDRIVE_CLIENT_ID',
    clientSecretEnv: 'PIPEDRIVE_CLIENT_SECRET',
    discoverer: 'pipedrive_deals',
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
  },

  // ─── ACTIVECAMPAIGN ──────────────────────────────────────────────────────────
  activecampaign: {
    slug: 'activecampaign',
    label: 'ActiveCampaign',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'activecampaign_lists',
    docsUrl: 'https://developers.activecampaign.com/reference',
    manualFields: [
      {
        name: 'api_key',
        label: 'ActiveCampaign API Key',
        secret: true,
        required: true,
        helpText: 'Settings → Developer → API Key',
        placeholder: 'your-api-key',
      },
      {
        name: 'api_url',
        label: 'API URL',
        secret: false,
        required: true,
        helpText: 'Your account URL (e.g. https://youraccount.api-us1.com)',
        placeholder: 'https://youraccount.api-us1.com',
      },
    ],
  },

  // ─── KLAVIYO ──────────────────────────────────────────────────────────────────
  klaviyo: {
    slug: 'klaviyo',
    label: 'Klaviyo',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'klaviyo_lists',
    docsUrl: 'https://developers.klaviyo.com/en/docs',
    manualFields: [
      {
        name: 'private_key',
        label: 'Klaviyo Private API Key',
        secret: true,
        required: true,
        helpText: 'Settings → API Keys → Private Key (starts with pk-)',
        placeholder: 'pk-xxxxx',
      },
    ],
  },

  // ─── CONVERTKIT ──────────────────────────────────────────────────────────────
  convertkit: {
    slug: 'convertkit',
    label: 'ConvertKit',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'convertkit_forms',
    docsUrl: 'https://developers.convertkit.com/',
    manualFields: [
      {
        name: 'api_key',
        label: 'ConvertKit API Key',
        secret: true,
        required: true,
        helpText: 'Settings → Advanced → API Key',
        placeholder: 'your-api-key',
      },
      {
        name: 'api_secret',
        label: 'ConvertKit API Secret',
        secret: true,
        required: true,
        helpText: 'Settings → Advanced → API Secret',
        placeholder: 'your-api-secret',
      },
    ],
  },

  // ─── WOOCOMMERCE (WordPress eCommerce) ──────────────────────────────────────
  woocommerce: {
    slug: 'woocommerce',
    label: 'WooCommerce',
    category: 'ecommerce',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'woocommerce_products',
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
    manualFields: [
      {
        name: 'site_url',
        label: 'WooCommerce Site URL',
        secret: false,
        required: true,
        helpText: 'Your WordPress site URL (e.g. https://shop.example.com)',
        placeholder: 'https://shop.example.com',
      },
      {
        name: 'consumer_key',
        label: 'Consumer Key',
        secret: true,
        required: true,
        helpText: 'WooCommerce → Settings → Advanced → REST API → Add Key. Permissions: Read/Write.',
        placeholder: 'ck_xxxxx',
      },
      {
        name: 'consumer_secret',
        label: 'Consumer Secret',
        secret: true,
        required: true,
        helpText: 'Generated alongside the Consumer Key.',
        placeholder: 'cs_xxxxx',
      },
    ],
  },

  // ─── ETSY ────────────────────────────────────────────────────────────────────
  etsy: {
    slug: 'etsy',
    label: 'Etsy',
    category: 'marketplace',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.etsy.com/oauth/connect',
    tokenUrl: 'https://api.etsy.com/v3/public/oauth/token',
    scopes: ['listings_r', 'listings_w', 'shops_r'],
    supportsPkce: true,
    clientIdEnv: 'ETSY_CLIENT_ID',
    clientSecretEnv: 'ETSY_CLIENT_SECRET',
    discoverer: 'etsy_shops',
    docsUrl: 'https://developers.etsy.com/docs/essentials/authentication',
  },

  // ─── AMAZON SELLER CENTRAL ───────────────────────────────────────────────────
  amazon_seller: {
    slug: 'amazon_seller',
    label: 'Amazon Seller Central (SP-API)',
    category: 'marketplace',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'amazon_orders',
    docsUrl: 'https://developer-docs.amazon.com/sp-api/docs/',
    manualFields: [
      {
        name: 'refresh_token',
        label: 'Amazon SP-API Refresh Token',
        secret: true,
        required: true,
        helpText: 'Obtained via Amazon Seller Central authorization flow.',
        placeholder: 'Atzr|...',
      },
      {
        name: 'lwa_client_id',
        label: 'Login with Amazon Client ID',
        secret: false,
        required: true,
        helpText: 'From Amazon Seller Central → Apps → Login with Amazon.',
        placeholder: 'amzn1.application-oa2-client.xxx',
      },
      {
        name: 'lwa_client_secret',
        label: 'Login with Amazon Client Secret',
        secret: true,
        required: true,
        helpText: 'From Amazon Seller Central → Apps → Login with Amazon.',
        placeholder: 'amzn1.oa2-cs.v1.xxx',
      },
      {
        name: 'aws_access_key',
        label: 'AWS Access Key ID',
        secret: true,
        required: true,
        helpText: 'AWS IAM user with SP-API execution permissions.',
        placeholder: 'AKIA...',
      },
      {
        name: 'aws_secret_key',
        label: 'AWS Secret Access Key',
        secret: true,
        required: true,
        helpText: 'AWS IAM user secret key.',
        placeholder: '...',
      },
    ],
  },

  // ─── EBAY ─────────────────────────────────────────────────────────────────────
  ebay: {
    slug: 'ebay',
    label: 'eBay',
    category: 'marketplace',
    authMethod: 'oauth',
    authorizeUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    scopes: ['https://api.ebay.com/oauth/api_scope', 'https://api.ebay.com/oauth/api_scope/sell.inventory'],
    supportsPkce: false,
    clientIdEnv: 'EBAY_CLIENT_ID',
    clientSecretEnv: 'EBAY_CLIENT_SECRET',
    discoverer: 'ebay_inventory',
    docsUrl: 'https://developer.ebay.com/api-docs/static/oauth-rest-quick-ref.html',
  },

  // ─── NOTION ───────────────────────────────────────────────────────────────────
  notion: {
    slug: 'notion',
    label: 'Notion',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    supportsPkce: false,
    clientIdEnv: 'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    discoverer: 'notion_pages',
    docsUrl: 'https://developers.notion.com/docs/authorization',
  },

  // ─── AIRTABLE ─────────────────────────────────────────────────────────────────
  airtable: {
    slug: 'airtable',
    label: 'Airtable',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    scopes: ['data.records:read', 'data.records:write'],
    supportsPkce: true,
    clientIdEnv: 'AIRTABLE_CLIENT_ID',
    clientSecretEnv: 'AIRTABLE_CLIENT_SECRET',
    discoverer: 'airtable_bases',
    docsUrl: 'https://airtable.com/developers/web/api/oauth-reference',
  },

  // ─── ZAPIER ──────────────────────────────────────────────────────────────────
  zapier: {
    slug: 'zapier',
    label: 'Zapier',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://zapier.com/dashboard/accept/invite/',
    tokenUrl: 'https://zapier.com/api/v2/oauth2/token/',
    scopes: ['zap', 'read', 'write'],
    supportsPkce: false,
    clientIdEnv: 'ZAPIER_CLIENT_ID',
    clientSecretEnv: 'ZAPIER_CLIENT_SECRET',
    discoverer: 'zapier_zaps',
    docsUrl: 'https://platform.zapier.com/docs/auth',
  },

  // ─── INTERCOM ────────────────────────────────────────────────────────────────
  intercom: {
    slug: 'intercom',
    label: 'Intercom',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://app.intercom.com/oauth',
    tokenUrl: 'https://api.intercom.io/auth/eagle/token',
    scopes: [],
    supportsPkce: false,
    clientIdEnv: 'INTERCOM_CLIENT_ID',
    clientSecretEnv: 'INTERCOM_CLIENT_SECRET',
    discoverer: 'intercom_contacts',
    docsUrl: 'https://developers.intercom.com/building-apps/docs/authentication-oauth',
  },

  // ─── ZENDESK ─────────────────────────────────────────────────────────────────
  zendesk: {
    slug: 'zendesk',
    label: 'Zendesk',
    category: 'crm',
    authMethod: 'oauth',
    authorizeUrl: 'https://{subdomain}.zendesk.com/oauth/authorizations/new',
    tokenUrl: 'https://{subdomain}.zendesk.com/oauth/tokens',
    scopes: ['read', 'write'],
    supportsPkce: false,
    clientIdEnv: 'ZENDESK_CLIENT_ID',
    clientSecretEnv: 'ZENDESK_CLIENT_SECRET',
    discoverer: 'zendesk_tickets',
    docsUrl: 'https://developer.zendesk.com/documentation/live-chat/integration-methods/oauth/',
  },

  // ─── WHATSAPP BUSINESS (via Meta OAuth — separate from manual above) ───────
  whatsapp_cloud: {
    slug: 'whatsapp_cloud',
    label: 'WhatsApp Business Cloud (OAuth)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: ['whatsapp_business_messaging', 'business_management'],
    supportsPkce: false,
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    discoverer: 'meta_whatsapp',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },

  // ─── GOOGLE SHEETS ───────────────────────────────────────────────────────────
  google_sheets: {
    slug: 'google_sheets',
    label: 'Google Sheets',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_sheets',
    docsUrl: 'https://developers.google.com/sheets/api',
  },

  // ─── GOOGLE DRIVE ────────────────────────────────────────────────────────────
  google_drive: {
    slug: 'google_drive',
    label: 'Google Drive',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_drive',
    docsUrl: 'https://developers.google.com/drive/api/guides/about-sdk',
  },

  // ─── MICROSOFT ADS ───────────────────────────────────────────────────────────
  microsoft_ads: {
    slug: 'microsoft_ads',
    label: 'Microsoft Ads (Bing)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://ads.microsoft.com/ads.manage'],
    supportsPkce: true,
    clientIdEnv: 'MICROSOFT_ADS_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_ADS_CLIENT_SECRET',
    discoverer: 'microsoft_ads_accounts',
    docsUrl: 'https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth',
  },

  // ─── CALENDLY ─────────────────────────────────────────────────────────────────
  calendly: {
    slug: 'calendly',
    label: 'Calendly',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://auth.calendly.com/oauth/authorize',
    tokenUrl: 'https://auth.calendly.com/oauth/token',
    scopes: [],
    supportsPkce: true,
    clientIdEnv: 'CALENDLY_CLIENT_ID',
    clientSecretEnv: 'CALENDLY_CLIENT_SECRET',
    discoverer: 'calendly_events',
    docsUrl: 'https://developer.calendly.com/api-docs',
  },

  // ─── TYPEFORM ────────────────────────────────────────────────────────────────
  typeform: {
    slug: 'typeform',
    label: 'Typeform',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://api.typeform.com/oauth/authorize',
    tokenUrl: 'https://api.typeform.com/oauth/token',
    scopes: ['forms:read', 'responses:read'],
    supportsPkce: true,
    clientIdEnv: 'TYPEFORM_CLIENT_ID',
    clientSecretEnv: 'TYPEFORM_CLIENT_SECRET',
    discoverer: 'typeform_forms',
    docsUrl: 'https://www.typeform.com/developers/get-started/',
  },

  // ─── WEBFLOW ──────────────────────────────────────────────────────────────────
  webflow: {
    slug: 'webflow',
    label: 'Webflow',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://webflow.com/oauth/authorize',
    tokenUrl: 'https://api.webflow.com/oauth/access_token',
    scopes: ['authorized_user:read', 'sites:read', 'cms:read'],
    supportsPkce: false,
    clientIdEnv: 'WEBFLOW_CLIENT_ID',
    clientSecretEnv: 'WEBFLOW_CLIENT_SECRET',
    discoverer: 'webflow_sites',
    docsUrl: 'https://developers.webflow.com/docs/oauth',
  },

  // ─── WIX ──────────────────────────────────────────────────────────────────────
  wix: {
    slug: 'wix',
    label: 'Wix',
    category: 'ecommerce',
    authMethod: 'oauth',
    authorizeUrl: 'https://www.wix.com/installer/install',
    tokenUrl: 'https://www.wix.com/oauth/access',
    scopes: [],
    supportsPkce: false,
    clientIdEnv: 'WIX_CLIENT_ID',
    clientSecretEnv: 'WIX_CLIENT_SECRET',
    discoverer: 'wix_store',
    docsUrl: 'https://dev.wix.com/docs/rest/api',
  },

  // ─── BIGCOMMERCE ──────────────────────────────────────────────────────────────
  bigcommerce: {
    slug: 'bigcommerce',
    label: 'BigCommerce',
    category: 'ecommerce',
    authMethod: 'oauth',
    authorizeUrl: 'https://login.bigcommerce.com/oauth2/authorize',
    tokenUrl: 'https://api.bigcommerce.com/{store_hash}/v2/oauth2/token',
    scopes: ['store_v2_products', 'store_v2_orders'],
    supportsPkce: false,
    clientIdEnv: 'BIGCOMMERCE_CLIENT_ID',
    clientSecretEnv: 'BIGCOMMERCE_CLIENT_SECRET',
    discoverer: 'bigcommerce_products',
    docsUrl: 'https://developer.bigcommerce.com/api-docs/getting-started/authentication',
  },

  // ─── SAMSUNG ADS ──────────────────────────────────────────────────────────────
  samsung_ads: {
    slug: 'samsung_ads',
    label: 'Samsung Ads',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'samsung_ads_campaigns',
    docsUrl: 'https://developer.samsung.com/ads',
    manualFields: [
      {
        name: 'api_key',
        label: 'Samsung Ads API Key',
        secret: true,
        required: true,
        helpText: 'Obtain from Samsung Ads Developer Portal.',
        placeholder: 'your-api-key',
      },
      {
        name: 'advertiser_id',
        label: 'Advertiser ID',
        secret: false,
        required: true,
        helpText: 'Your Samsung Ads advertiser ID.',
        placeholder: '12345',
      },
    ],
  },

  // ─── SNAPCHAT ADS ─────────────────────────────────────────────────────────────
  snapchat_ads: {
    slug: 'snapchat_ads',
    label: 'Snapchat Ads',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
    tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
    scopes: ['snapchat-marketing-api'],
    supportsPkce: true,
    clientIdEnv: 'SNAPCHAT_CLIENT_ID',
    clientSecretEnv: 'SNAPCHAT_CLIENT_SECRET',
    discoverer: 'snapchat_ad_accounts',
    docsUrl: 'https://business.snapchat.com/marketingapi',
  },

  // ─── MEDIUM ───────────────────────────────────────────────────────────────────
  medium: {
    slug: 'medium',
    label: 'Medium',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://medium.com/m/oauth/authorize',
    tokenUrl: 'https://api.medium.com/v1/tokens',
    scopes: ['basicProfile', 'listPublications', 'publishPost'],
    supportsPkce: false,
    clientIdEnv: 'MEDIUM_CLIENT_ID',
    clientSecretEnv: 'MEDIUM_CLIENT_SECRET',
    discoverer: 'medium_publications',
    docsUrl: 'https://developers.medium.com/',
  },

  // ─── GITHUB ───────────────────────────────────────────────────────────────────
  github: {
    slug: 'github',
    label: 'GitHub',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:org'],
    supportsPkce: false,
    clientIdEnv: 'GITHUB_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GITHUB_OAUTH_CLIENT_SECRET',
    discoverer: 'github_repos',
    docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps',
  },

  // ─── GOOGLE FORMS ────────────────────────────────────────────────────────────
  google_forms: {
    slug: 'google_forms',
    label: 'Google Forms',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_forms',
    docsUrl: 'https://developers.google.com/forms/api',
  },

  // ─── LINE ─────────────────────────────────────────────────────────────────────
  line: {
    slug: 'line',
    label: 'LINE',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://access.line.me/oauth2/v2.1/authorize',
    tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
    scopes: ['profile', 'openid', 'chat_message.write'],
    supportsPkce: true,
    clientIdEnv: 'LINE_CHANNEL_ID',
    clientSecretEnv: 'LINE_CHANNEL_SECRET',
    discoverer: 'line_profile',
    docsUrl: 'https://developers.line.biz/en/docs/line-login/',
  },

  // ─── VIBER ────────────────────────────────────────────────────────────────────
  viber: {
    slug: 'viber',
    label: 'Viber',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'viber_account_info',
    docsUrl: 'https://developers.viber.com/docs/api/rest-bot-api/',
    manualFields: [
      {
        name: 'auth_token',
        label: 'Viber Bot Auth Token',
        secret: true,
        required: true,
        helpText: 'Create a bot via Viber Bot Platform. Copy the auth token.',
        placeholder: 'your-auth-token',
      },
    ],
  },

  // ─── SIGNAL ───────────────────────────────────────────────────────────────────
  signal: {
    slug: 'signal',
    label: 'Signal',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'signal_account',
    docsUrl: 'https://signal.org/docs/',
    manualFields: [
      {
        name: 'api_url',
        label: 'Signal CLI REST API URL',
        secret: false,
        required: true,
        helpText: 'URL of your self-hosted signal-cli-rest-api instance.',
        placeholder: 'http://localhost:8080',
      },
      {
        name: 'phone_number',
        label: 'Signal Phone Number',
        secret: false,
        required: true,
        helpText: 'The registered Signal phone number (E.164 format).',
        placeholder: '+15551234567',
      },
    ],
  },

  // ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────────
  google_calendar: {
    slug: 'google_calendar',
    label: 'Google Calendar',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_calendar',
    docsUrl: 'https://developers.google.com/calendar/api/v3/reference',
  },

  // ─── DRIP ─────────────────────────────────────────────────────────────────────
  drip: {
    slug: 'drip',
    label: 'Drip',
    category: 'email',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'drip_campaigns',
    docsUrl: 'https://developer.drip.com/',
    manualFields: [
      {
        name: 'api_token',
        label: 'Drip API Token',
        secret: true,
        required: true,
        helpText: 'Settings → API → Token',
        placeholder: 'your-api-token',
      },
      {
        name: 'account_id',
        label: 'Account ID',
        secret: false,
        required: true,
        helpText: 'Found in the URL of your Drip dashboard.',
        placeholder: '1234567',
      },
    ],
  },

  // ─── ONESIGNAL ────────────────────────────────────────────────────────────────
  onesignal: {
    slug: 'onesignal',
    label: 'OneSignal (Push Notifications)',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'onesignal_apps',
    docsUrl: 'https://documentation.onesignal.com/reference',
    manualFields: [
      {
        name: 'app_id',
        label: 'OneSignal App ID',
        secret: false,
        required: true,
        helpText: 'Settings → Keys & IDs → App ID',
        placeholder: 'your-app-id',
      },
      {
        name: 'rest_api_key',
        label: 'REST API Key',
        secret: true,
        required: true,
        helpText: 'Settings → Keys & IDs → REST API Key',
        placeholder: 'your-rest-api-key',
      },
    ],
  },

  // ─── FIREBASE CLOUD MESSAGING ─────────────────────────────────────────────────
  firebase: {
    slug: 'firebase',
    label: 'Firebase Cloud Messaging',
    category: 'other',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'firebase_projects',
    docsUrl: 'https://firebase.google.com/docs/cloud-messaging',
    manualFields: [
      {
        name: 'server_key',
        label: 'FCM Server Key',
        secret: true,
        required: true,
        helpText: 'Firebase Console → Project Settings → Cloud Messaging → Server Key',
        placeholder: 'AAAA...',
      },
      {
        name: 'project_id',
        label: 'Firebase Project ID',
        secret: false,
        required: true,
        helpText: 'Firebase Console → Project Settings → General → Project ID',
        placeholder: 'your-project-id',
      },
    ],
  },

  // ─── MICROSOFT TEAMS ─────────────────────────────────────────────────────────
  microsoft_teams: {
    slug: 'microsoft_teams',
    label: 'Microsoft Teams',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://graph.microsoft.com/Channel.ReadBasic.All', 'https://graph.microsoft.com/Chat.ReadWrite'],
    supportsPkce: true,
    clientIdEnv: 'TEAMS_CLIENT_ID',
    clientSecretEnv: 'TEAMS_CLIENT_SECRET',
    discoverer: 'teams_channels',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview',
  },

  // ─── GOOGLE MEET ─────────────────────────────────────────────────────────────
  google_meet: {
    slug: 'google_meet',
    label: 'Google Meet',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/meetings.space.readonly', 'https://www.googleapis.com/auth/meetings.space.created'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_meet_spaces',
    docsUrl: 'https://developers.google.com/meet/api',
  },

  // ─── ZOOM ─────────────────────────────────────────────────────────────────────
  zoom: {
    slug: 'zoom',
    label: 'Zoom',
    category: 'other',
    authMethod: 'oauth',
    authorizeUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scopes: ['meeting:read', 'meeting:write'],
    supportsPkce: false,
    clientIdEnv: 'ZOOM_CLIENT_ID',
    clientSecretEnv: 'ZOOM_CLIENT_SECRET',
    discoverer: 'zoom_meetings',
    docsUrl: 'https://developers.zoom.us/docs/api/rest/',
  },

  // ─── WHATSAPP BUSINESS (via Twilio) ──────────────────────────────────────────
  whatsapp_twilio: {
    slug: 'whatsapp_twilio',
    label: 'WhatsApp via Twilio',
    category: 'social',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'whatsapp_twilio_numbers',
    docsUrl: 'https://www.twilio.com/docs/whatsapp',
    manualFields: [
      {
        name: 'account_sid',
        label: 'Twilio Account SID',
        secret: true,
        required: true,
        helpText: 'Twilio Console → Account → Account SID',
        placeholder: 'AC...',
      },
      {
        name: 'auth_token',
        label: 'Twilio Auth Token',
        secret: true,
        required: true,
        helpText: 'Twilio Console → Account → Auth Token',
        placeholder: 'your-auth-token',
      },
      {
        name: 'from_number',
        label: 'WhatsApp Sender Number',
        secret: false,
        required: true,
        helpText: 'Twilio-provided WhatsApp number (E.164 format).',
        placeholder: '+15551234567',
      },
    ],
  },

  // ─── GOOGLE MY BUSINESS (standalone, separate from google_business above) ────
  google_my_business: {
    slug: 'google_my_business',
    label: 'Google My Business (Posts)',
    category: 'social',
    authMethod: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    discoverer: 'google_business',
    docsUrl: 'https://developers.google.com/my-business/content/post-data',
  },

  // ─── BING WEBMASTER ──────────────────────────────────────────────────────────
  bing_webmaster: {
    slug: 'bing_webmaster',
    label: 'Bing Webmaster Tools',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'bing_sites',
    docsUrl: 'https://www.bing.com/webmaster/help/api-reference',
    manualFields: [
      {
        name: 'api_key',
        label: 'Bing Webmaster API Key',
        secret: true,
        required: true,
        helpText: 'Bing Webmaster Tools → Configure → API',
        placeholder: 'your-api-key',
      },
    ],
  },

  // ─── YELP ────────────────────────────────────────────────────────────────────
  yelp: {
    slug: 'yelp',
    label: 'Yelp for Business',
    category: 'marketplace',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'yelp_business',
    docsUrl: 'https://docs.developer.yelp.com/',
    manualFields: [
      {
        name: 'api_key',
        label: 'Yelp API Key',
        secret: true,
        required: true,
        helpText: 'Create at Yelp Developers → Manage App → API Key',
        placeholder: 'your-api-key',
      },
      {
        name: 'business_id',
        label: 'Business ID',
        secret: false,
        required: true,
        helpText: 'Your Yelp business ID (found in your Yelp URL).',
        placeholder: 'your-business-id',
      },
    ],
  },

  // ─── TRUSTPILOT ──────────────────────────────────────────────────────────────
  trustpilot: {
    slug: 'trustpilot',
    label: 'Trustpilot',
    category: 'marketplace',
    authMethod: 'oauth',
    authorizeUrl: 'https://authenticate.trustpilot.com',
    tokenUrl: 'https://api.trustpilot.com/v1/oauth/oauth-business-users/token',
    scopes: ['read', 'write'],
    supportsPkce: false,
    clientIdEnv: 'TRUSTPILOT_CLIENT_ID',
    clientSecretEnv: 'TRUSTPILOT_CLIENT_SECRET',
    discoverer: 'trustpilot_reviews',
    docsUrl: 'https://developers.trustpilot.com/',
  },

  // ─── GOOGLE MAPS ──────────────────────────────────────────────────────────────
  google_maps: {
    slug: 'google_maps',
    label: 'Google Maps Platform',
    category: 'analytics',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'google_maps_geocode',
    docsUrl: 'https://developers.google.com/maps/documentation',
    manualFields: [
      {
        name: 'api_key',
        label: 'Google Maps API Key',
        secret: true,
        required: true,
        helpText: 'Google Cloud Console → APIs & Services → Credentials → API Key (with Maps JavaScript API enabled).',
        placeholder: 'AIza...',
      },
    ],
  },

  // ─── HOTJAR ──────────────────────────────────────────────────────────────────
  hotjar: {
    slug: 'hotjar',
    label: 'Hotjar',
    category: 'analytics',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'hotjar_sites',
    docsUrl: 'https://help.hotjar.com/hc/en-us/articles/4405132768151-Hotjar-API',
    manualFields: [
      {
        name: 'site_id',
        label: 'Hotjar Site ID',
        secret: false,
        required: true,
        helpText: 'Found in your Hotjar tracking code.',
        placeholder: '1234567',
      },
      {
        name: 'api_key',
        label: 'Hotjar API Key',
        secret: true,
        required: true,
        helpText: 'Settings → Integrations → API Key',
        placeholder: 'your-api-key',
      },
    ],
  },

  // ─── MIXPANEL ────────────────────────────────────────────────────────────────
  mixpanel: {
    slug: 'mixpanel',
    label: 'Mixpanel',
    category: 'analytics',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'mixpanel_events',
    docsUrl: 'https://developer.mixpanel.com/docs/',
    manualFields: [
      {
        name: 'project_token',
        label: 'Mixpanel Project Token',
        secret: true,
        required: true,
        helpText: 'Project Settings → Access Keys → Project Token',
        placeholder: 'your-project-token',
      },
      {
        name: 'service_account_username',
        label: 'Service Account Username',
        secret: false,
        required: true,
        helpText: 'Project Settings → Service Accounts',
        placeholder: 'service-account@example.com',
      },
      {
        name: 'service_account_password',
        label: 'Service Account Password',
        secret: true,
        required: true,
        helpText: 'Generated with the service account username.',
        placeholder: 'your-password',
      },
    ],
  },

  // ─── AMPLITUDE ────────────────────────────────────────────────────────────────
  amplitude: {
    slug: 'amplitude',
    label: 'Amplitude',
    category: 'analytics',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'amplitude_events',
    docsUrl: 'https://developers.amplitude.com/docs',
    manualFields: [
      {
        name: 'api_key',
        label: 'Amplitude API Key',
        secret: true,
        required: true,
        helpText: 'Project Settings → General → API Key',
        placeholder: 'your-api-key',
      },
      {
        name: 'secret_key',
        label: 'Amplitude Secret Key',
        secret: true,
        required: true,
        helpText: 'Project Settings → General → Secret Key',
        placeholder: 'your-secret-key',
      },
    ],
  },

  // ─── POSTHOG ──────────────────────────────────────────────────────────────────
  posthog: {
    slug: 'posthog',
    label: 'PostHog',
    category: 'analytics',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'posthog_events',
    docsUrl: 'https://posthog.com/docs/api',
    manualFields: [
      {
        name: 'api_key',
        label: 'PostHog API Key',
        secret: true,
        required: true,
        helpText: 'Project Settings → API Key (Personal API Key for management API).',
        placeholder: 'phx...',
      },
      {
        name: 'project_id',
        label: 'Project ID',
        secret: false,
        required: true,
        helpText: 'Found in Project Settings.',
        placeholder: '12345',
      },
      {
        name: 'host',
        label: 'PostHog Host',
        secret: false,
        required: true,
        helpText: 'PostHog instance URL (e.g. https://app.posthog.com or self-hosted URL).',
        placeholder: 'https://app.posthog.com',
      },
    ],
  },

  // ─── SEMRUSH ──────────────────────────────────────────────────────────────────
  semrush: {
    slug: 'semrush',
    label: 'SEMrush',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'semrush_domains',
    docsUrl: 'https://www.semrush.com/api-documentation/',
    manualFields: [
      {
        name: 'api_key',
        label: 'SEMrush API Key',
        secret: true,
        required: true,
        helpText: 'Profile → API Units → API Key',
        placeholder: 'your-api-key',
      },
    ],
  },

  // ─── AHREFS ──────────────────────────────────────────────────────────────────
  ahrefs: {
    slug: 'ahrefs',
    label: 'Ahrefs',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'ahrefs_sites',
    docsUrl: 'https://ahrefs.com/api',
    manualFields: [
      {
        name: 'api_token',
        label: 'Ahrefs API Token',
        secret: true,
        required: true,
        helpText: 'Settings → API → Token',
        placeholder: 'your-api-token',
      },
    ],
  },

  // ─── MOZ ──────────────────────────────────────────────────────────────────────
  moz: {
    slug: 'moz',
    label: 'Moz (SEO)',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'moz_metrics',
    docsUrl: 'https://moz.com/api',
    manualFields: [
      {
        name: 'access_id',
        label: 'Moz Access ID',
        secret: false,
        required: true,
        helpText: 'Settings → API → Access ID',
        placeholder: 'your-access-id',
      },
      {
        name: 'secret_key',
        label: 'Moz Secret Key',
        secret: true,
        required: true,
        helpText: 'Settings → API → Secret Key',
        placeholder: 'your-secret-key',
      },
    ],
  },

  // ─── SCHEMA.ORG MARKUP (manual) ──────────────────────────────────────────────
  schema_markup: {
    slug: 'schema_markup',
    label: 'Schema.org Markup Validator',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'schema_validation',
    docsUrl: 'https://validator.schema.org/',
    manualFields: [
      {
        name: 'site_url',
        label: 'Site URL to Validate',
        secret: false,
        required: true,
        helpText: 'The URL of the page whose schema markup you want to validate.',
        placeholder: 'https://example.com',
      },
    ],
  },

  // ─── GOOGLE PAGE SPEED INSIGHTS ──────────────────────────────────────────────
  google_page_speed: {
    slug: 'google_page_speed',
    label: 'Google PageSpeed Insights',
    category: 'seo',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'google_page_speed',
    docsUrl: 'https://developers.google.com/speed/docs/insights/v5/reference',
    manualFields: [
      {
        name: 'api_key',
        label: 'Google API Key',
        secret: true,
        required: true,
        helpText: 'Google Cloud Console → APIs & Services → PageSpeed Insights API → Credentials.',
        placeholder: 'AIza...',
      },
    ],
  },

  // ─── CUSTOM WEBHOOK (user-defined) ───────────────────────────────────────────
  custom_webhook: {
    slug: 'custom_webhook',
    label: 'Custom Webhook',
    category: 'other',
    authMethod: 'manual',
    scopes: [],
    supportsPkce: false,
    discoverer: 'custom_webhook_test',
    docsUrl: '',
    manualFields: [
      {
        name: 'webhook_url',
        label: 'Webhook URL',
        secret: false,
        required: true,
        helpText: 'The URL to send/receive webhooks.',
        placeholder: 'https://your-server.com/webhook',
      },
      {
        name: 'signing_secret',
        label: 'Webhook Signing Secret',
        secret: true,
        required: false,
        helpText: 'HMAC-SHA256 signing secret for webhook verification.',
        placeholder: 'whsec_...',
      },
    ],
  },
};

export function getProvider(slug: string): ProviderDefinition | null {
  return PROVIDERS[slug] || null;
}

export function listProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}

export function listProvidersByCategory(category: ProviderDefinition['category']): ProviderDefinition[] {
  return Object.values(PROVIDERS).filter((p) => p.category === category);
}

/**
 * Resolve the OAuth client_id for a provider from the env vars named in
 * the provider definition. Returns null if the provider has no OAuth
 * client configured — the API route will then return action_required.
 */
export function resolveOAuthClientId(provider: ProviderDefinition): string | null {
  if (!provider.clientIdEnv) return null;
  const val = process.env[provider.clientIdEnv];
  return val && val.length > 0 ? val : null;
}

export function resolveOAuthClientSecret(provider: ProviderDefinition): string | null {
  if (!provider.clientSecretEnv) return null;
  const val = process.env[provider.clientSecretEnv];
  return val && val.length > 0 ? val : null;
}

/**
 * The canonical redirect URI for OAuth callbacks. Always points at the
 * MarketingOS origin (NEXT_PUBLIC_SITE_URL) so the provider's
 * redirect_uri allowlist can be configured once per environment.
 */
export function getCallbackUrl(provider: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  return `${origin}/api/v1/integrations/${provider}/callback`;
}
