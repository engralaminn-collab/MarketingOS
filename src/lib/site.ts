/**
 * Canonical site metadata.
 *
 * Everything that emits an absolute URL (metadata, Open Graph, robots.txt,
 * sitemap.xml) reads it from here. Previously the layout hard-coded
 * `https://www.kexsio.com` while robots/sitemap hard-coded
 * `https://marketingos.ai`, so search engines were handed two different
 * origins for the same deployment.
 *
 * Override with NEXT_PUBLIC_SITE_URL (no trailing slash), e.g. when the app is
 * served from a staging domain or a custom host.
 */

function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kexsio.com').trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  try {
    const parsed = new URL(withoutTrailingSlash);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    return withoutTrailingSlash;
  } catch {
    // A malformed override must not produce a broken canonical URL.
    return 'https://www.kexsio.com';
  }
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = 'Kexsio MarketingOS';
export const SITE_TITLE = 'Kexsio MarketingOS — Enterprise AI Workforce Platform';
export const SITE_DESCRIPTION =
  'Kexsio MarketingOS — AI-assisted marketing operations with a catalog of 116 integrations, CRM, SEO, content, and campaign tools. Built by Kexsio.';
export const OG_IMAGE = `${SITE_URL}/kexsio-logo.png`;
