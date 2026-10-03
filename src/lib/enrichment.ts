/**
 * Lead enrichment service — auto-fill company info from an email domain.
 * Inspired by brightdata/open-enrich + parthasarathy123/n8n-gtm-lead-enrichment.
 *
 * Strategy (no external API keys required):
 *   1. Check local EnrichmentCache table (avoid duplicate fetches)
 *   2. Fetch the domain's homepage HTML and parse <title>, <meta> tags
 *   3. Try to fetch /robots.txt and /sitemap.xml for extra context
 *   4. Extract: company name, industry, description, logo, website
 *   5. Heuristic: classify industry based on keywords in title/description
 *
 * Returns the enriched fields. Caller (API route) writes them to the Lead.
 */
import { db } from './db';

export interface EnrichmentResult {
  domain: string;
  companyName: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  logo: string | null;
  employees: string | null;
  foundedYear: number | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  source: 'cache' | 'fetched' | 'failed';
}

export async function enrichByDomain(domain: string): Promise<EnrichmentResult> {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();

  // 1. Check cache first
  const cached = await db.enrichmentCache.findUnique({ where: { domain: cleanDomain } }).catch(() => null);
  if (cached) {
    return {
      domain: cached.domain,
      companyName: cached.companyName,
      industry: cached.industry,
      website: cached.website,
      description: cached.description,
      logo: cached.logo,
      employees: cached.employees,
      foundedYear: cached.foundedYear,
      linkedinUrl: cached.linkedinUrl,
      twitterHandle: cached.twitterHandle,
      source: 'cache',
    };
  }

  // 2. Fetch the homepage
  const result: EnrichmentResult = {
    domain: cleanDomain,
    companyName: null,
    industry: null,
    website: `https://${cleanDomain}`,
    description: null,
    logo: null,
    employees: null,
    foundedYear: null,
    linkedinUrl: null,
    twitterHandle: null,
    source: 'fetched',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://${cleanDomain}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketingOS/1.0; enrichment-bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      result.source = 'failed';
      await cacheResult(cleanDomain, result);
      return result;
    }

    const html = await res.text();
    const parsed = parseHtmlForCompanyInfo(html, cleanDomain);
    Object.assign(result, parsed);

    // Try to find LinkedIn + Twitter handles by scanning for social links in HTML
    const linkedinMatch = html.match(/linkedin\.com\/(?:company|in)\/([a-z0-9_-]+)/i);
    if (linkedinMatch) result.linkedinUrl = `https://linkedin.com/company/${linkedinMatch[1]}`;
    const twitterMatch = html.match(/twitter\.com\/([a-z0-9_]+)/i);
    if (twitterMatch) result.twitterHandle = `@${twitterMatch[1]}`;

    // Heuristic industry classification from title/description keywords
    if (!result.industry) {
      result.industry = classifyIndustry(
        `${result.companyName || ''} ${result.description || ''}`,
      );
    }
  } catch {
    result.source = 'failed';
  }

  await cacheResult(cleanDomain, result);
  return result;
}

/**
 * Enrich by email — extract domain from email and call enrichByDomain.
 */
export async function enrichByEmail(email: string): Promise<EnrichmentResult | null> {
  const match = email.match(/@([\w.-]+)/);
  if (!match) return null;
  return enrichByDomain(match[1]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseHtmlForCompanyInfo(html: string, domain: string): Partial<EnrichmentResult> {
  const result: Partial<EnrichmentResult> = {};

  // <title>Acme Inc — We build things</title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // Use the first part before "—" or "|" or ":" as the company name
    const parts = title.split(/[—|:·–-]/).map((p) => p.trim()).filter(Boolean);
    result.companyName = parts[0] || title.slice(0, 80);
    if (!result.description && parts.length > 1) {
      result.description = parts.slice(1).join(' — ').slice(0, 300);
    }
  }

  // <meta name="description" content="...">
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) {
    result.description = (descMatch[1] || '').trim().slice(0, 300);
  }

  // <meta property="og:site_name" content="...">
  const siteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  if (siteNameMatch) {
    result.companyName = siteNameMatch[1].trim();
  }

  // <meta property="og:image" content="..."> — useful as logo
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    result.logo = ogImageMatch[1].trim();
  }

  // <link rel="icon" href="/favicon.ico">
  const faviconMatch = html.match(/<link\s+rel=["'](?:icon|shortcut icon)["']\s+href=["']([^"']+)["']/i);
  if (faviconMatch && !result.logo) {
    const href = faviconMatch[1].trim();
    result.logo = href.startsWith('http') ? href : `https://${domain}${href}`;
  }

  return result;
}

function classifyIndustry(text: string): string {
  const t = text.toLowerCase();
  const rules: { industry: string; keywords: string[] }[] = [
    { industry: 'SaaS / Software', keywords: ['software', 'saas', 'platform', 'cloud', 'api', 'app'] },
    { industry: 'Finance / FinTech', keywords: ['finance', 'fintech', 'banking', 'payment', 'invest', 'trading'] },
    { industry: 'Healthcare', keywords: ['health', 'medical', 'patient', 'clinic', 'doctor', 'pharma'] },
    { industry: 'E-commerce / Retail', keywords: ['shop', 'store', 'commerce', 'retail', 'buy', 'product'] },
    { industry: 'Education', keywords: ['education', 'learn', 'course', 'student', 'school', 'training'] },
    { industry: 'Marketing / Advertising', keywords: ['marketing', 'advertis', 'brand', 'campaign', 'seo'] },
    { industry: 'Real Estate', keywords: ['real estate', 'property', 'rent', 'lease', 'house'] },
    { industry: 'Manufacturing', keywords: ['manufactur', 'industrial', 'factory', 'production', 'supply'] },
    { industry: 'Consulting', keywords: ['consult', 'advisory', 'professional services'] },
    { industry: 'Media / Publishing', keywords: ['media', 'news', 'publish', 'magazine', 'journal'] },
    { industry: 'AI / ML', keywords: ['artificial intelligence', 'machine learning', 'ai ', 'ml ', 'neural'] },
    { industry: 'Cybersecurity', keywords: ['security', 'cyber', 'vulnerab', 'threat', 'protect'] },
    { industry: 'Logistics', keywords: ['logistics', 'shipping', 'freight', 'delivery', 'warehouse'] },
  ];
  for (const r of rules) {
    if (r.keywords.some((k) => t.includes(k))) return r.industry;
  }
  return 'Technology';
}

async function cacheResult(domain: string, result: EnrichmentResult): Promise<void> {
  try {
    await db.enrichmentCache.upsert({
      where: { domain },
      create: {
        domain,
        companyName: result.companyName,
        industry: result.industry,
        website: result.website,
        description: result.description,
        logo: result.logo,
        employees: result.employees,
        foundedYear: result.foundedYear,
        linkedinUrl: result.linkedinUrl,
        twitterHandle: result.twitterHandle,
      },
      update: {
        companyName: result.companyName,
        industry: result.industry,
        website: result.website,
        description: result.description,
        logo: result.logo,
        employees: result.employees,
        foundedYear: result.foundedYear,
        linkedinUrl: result.linkedinUrl,
        twitterHandle: result.twitterHandle,
        fetchedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('[enrichment cache] failed:', err);
  }
}
