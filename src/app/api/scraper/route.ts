import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { enrichByDomain } from '@/lib/enrichment';
import { emitEvent } from '@/lib/events';
import { FirecrawlScrapeError, scrapeWithFirecrawl } from '@/lib/firecrawl-scraper';
import { isUrlSafe, SafeFetchError, safeFetchText } from '@/lib/ssrf';

// POST /api/scraper — scrape a URL for research (firecrawl pattern)
// Body: { url: string, mode?: "summary" | "metadata" | "full" }
//
// Modes:
//   - "summary" (default): Strip HTML, return first 500 chars + title + meta description
//   - "metadata": Just <title>, <meta> tags, no body
//   - "full": Strip HTML, return up to 10k chars of text + all metadata
//
// Also tries to create a Lead if the URL contains an email or contact info.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || url.length > 2048) return NextResponse.json({ error: 'A valid URL up to 2,048 characters is required' }, { status: 400 });
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'A valid HTTP or HTTPS URL is required' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 });
    }

    const mode = ['summary', 'metadata', 'full'].includes(body.mode) ? body.mode as 'summary' | 'metadata' | 'full' : 'summary';
    let html = '';
    let markdown = '';
    let scrapedMetadata: Record<string, unknown> = {};
    const finalUrl = parsedUrl.toString();
    const domain = parsedUrl.hostname.replace(/^www\./, '');
    const firecrawlConfigured = Boolean(process.env.FIRECRAWL_BASE_URL?.trim());

    if (firecrawlConfigured) {
      // This preflight blocks private and reserved targets before the URL is
      // handed to the operator-configured Firecrawl service. The crawler must
      // also enforce its own egress/SSRF policy because it performs the fetch.
      const validation = await isUrlSafe(finalUrl);
      if (!validation.allowed) {
        return NextResponse.json({ error: 'The URL resolves to a restricted or non-public destination' }, { status: 400 });
      }
      try {
        const page = await scrapeWithFirecrawl(finalUrl, mode);
        if (!page) return NextResponse.json({ error: 'Firecrawl is not configured' }, { status: 503 });
        html = page.html;
        markdown = page.markdown;
        scrapedMetadata = page.metadata;
      } catch (error) {
        if (error instanceof FirecrawlScrapeError && error.code === 'CONFIG') {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (error instanceof FirecrawlScrapeError && error.code === 'TIMEOUT') {
          return NextResponse.json({ error: 'The configured Firecrawl service did not respond in time' }, { status: 504 });
        }
        if (error instanceof FirecrawlScrapeError && error.code === 'TOO_LARGE') {
          return NextResponse.json({ error: 'The Firecrawl response exceeds the 2 MB limit' }, { status: 413 });
        }
        return NextResponse.json({ error: 'The configured Firecrawl service could not scrape this URL' }, { status: 502 });
      }
    } else {
      let res;
      try {
        res = await safeFetchText(finalUrl, {
          timeoutMs: 15_000,
          maxResponseBytes: 2 * 1024 * 1024,
          headers: {
            'User-Agent': 'MarketingOS-Research/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
      } catch (error) {
        if (error instanceof SafeFetchError && error.code === 'SSRF_BLOCKED') {
          return NextResponse.json({ error: 'The URL resolves to a restricted or non-public destination' }, { status: 400 });
        }
        if (error instanceof SafeFetchError && error.code === 'TOO_LARGE') {
          return NextResponse.json({ error: 'The page exceeds the 2 MB response limit' }, { status: 413 });
        }
        if (error instanceof SafeFetchError && error.code === 'TIMEOUT') {
          return NextResponse.json({ error: 'The website did not respond in time' }, { status: 504 });
        }
        if (error instanceof SafeFetchError && error.code === 'REDIRECT') {
          return NextResponse.json({ error: 'Redirects are not followed; submit the final page URL' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Unable to safely fetch this URL' }, { status: 502 });
      }

      if (!res.ok) {
        return NextResponse.json({ error: `Failed to fetch URL — HTTP ${res.status}` }, { status: 502 });
      }
      html = await res.text();
    }

    // Prefer Firecrawl's parsed metadata/Markdown when enabled; the default
    // direct mode keeps using the pinned, SSRF-safe HTTP fetcher.
    const metadataString = (...keys: string[]) => {
      for (const key of keys) {
        const value = scrapedMetadata[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = metadataString('title', 'ogTitle') || (titleMatch ? titleMatch[1].trim() : null);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = metadataString('description', 'ogDescription') || (descMatch ? descMatch[1].trim() : null);
    const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    const siteName = metadataString('ogSiteName', 'siteName') || (ogSiteMatch ? ogSiteMatch[1].trim() : null);
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const ogImage = metadataString('ogImage', 'og:image') || (ogImageMatch ? ogImageMatch[1].trim() : null);

    const contactSource = `${markdown}\n${html}`;
    const emailMatches = Array.from(new Set(
      (contactSource.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
        .filter((email) => !/\.(?:png|jpg|gif)$/i.test(email))
    )).slice(0, 5);
    const phoneMatches = Array.from(new Set(
      contactSource.match(/\+?1?[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g) || []
    )).slice(0, 3);

    const text = markdown.trim()
      ? markdown.replace(/\n{3,}/g, '\n\n').trim()
      : html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

    const maxChars = mode === 'full' ? 10000 : mode === 'summary' ? 500 : 0;
    const textBody = maxChars > 0 ? text.slice(0, maxChars) : '';

    // Try enrichment if we have a domain
    let enrichment: Awaited<ReturnType<typeof enrichByDomain>> | null = null;
    if (mode !== 'metadata') {
      try {
        enrichment = await enrichByDomain(domain);
      } catch {
        // enrichment is best-effort
      }
    }

    // Fire event for the scrape
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'scraper.url_scraped',
      title: 'URL scraped',
      description: `Scraped ${domain} — ${emailMatches.length} emails, ${phoneMatches.length} phones found`,
      resourceType: 'scraper',
      link: undefined,
      metadata: { url: finalUrl, domain, provider: firecrawlConfigured ? 'firecrawl' : 'safe-http', emailCount: emailMatches.length, phoneCount: phoneMatches.length },
    });

    return NextResponse.json({
      data: {
        url: finalUrl,
        domain,
        title,
        description,
        siteName,
        ogImage,
        emails: emailMatches,
        phones: phoneMatches,
        text: textBody,
        textLength: text.length,
        enrichment,
        scrapeProvider: firecrawlConfigured ? 'firecrawl' : 'safe-http',
        scrapedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[POST /api/scraper]', err);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
