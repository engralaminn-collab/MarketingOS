import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { isUrlSafe, safeFetchText } from '@/lib/ssrf';
import { analyzeAiWritingTells } from '@/lib/ai-extensions';

interface SeoCheckItem {
  id: string;
  category: 'on-page' | 'technical' | 'schema-social' | 'content-quality' | 'ai-visibility';
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  weight: number;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function analyzeHtmlDocument(html: string, sourceUrl = 'https://example.com', targetKeyword = '') {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const metaDescription = descMatch ? descMatch[1].trim() : '';

  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

  const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);
  const robots = robotsMatch ? robotsMatch[1].trim() : '';

  const viewportMatch = html.match(/<meta[^>]+name=["']viewport["']/i);
  const ogTags = Array.from(html.matchAll(/<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)["']/gi)).map(
    (m) => ({ property: m[1].toLowerCase(), content: m[2] }),
  );
  const twitterTags = Array.from(html.matchAll(/<meta[^>]+name=["'](twitter:[^"']+)["'][^>]+content=["']([^"']*)["']/gi)).map(
    (m) => ({ name: m[1].toLowerCase(), content: m[2] }),
  );
  const jsonLdBlocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ).map((m) => m[1].trim());

  const h1s = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) => stripTags(m[1])).filter(Boolean);
  const h2s = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => stripTags(m[1])).filter(Boolean);
  const h3s = Array.from(html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)).map((m) => stripTags(m[1])).filter(Boolean);

  const imgTags = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const imgsMissingAlt = imgTags.filter((tag) => !/\balt=["'][^"']+["']/i.test(tag)).length;

  const anchorHrefs = Array.from(html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)).map((m) => m[1]);
  let host = 'example.com';
  try {
    host = new URL(sourceUrl).hostname;
  } catch {
    host = 'example.com';
  }
  let internalLinks = 0;
  let externalLinks = 0;
  for (const href of anchorHrefs) {
    if (href.startsWith('/') || href.startsWith('#') || href.includes(host)) internalLinks += 1;
    else if (/^https?:\/\//i.test(href)) externalLinks += 1;
  }

  const bodyText = stripTags(html);
  const words = bodyText ? bodyText.split(/\s+/) : [];
  const wordCount = words.length;
  const kw = targetKeyword.trim().toLowerCase();
  const kwOccurrences = kw
    ? (bodyText.toLowerCase().split(kw).length - 1)
    : 0;
  const kwDensity = wordCount > 0 && kw ? Number(((kwOccurrences * kw.split(/\s+/).length / wordCount) * 100).toFixed(2)) : 0;

  // Top extracted topic clusters (every-app/open-seo keyword-clustering)
  const stop = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'from', 'your', 'you', 'are', 'our', 'can', 'will', 'more', 'have', 'into', 'about']);
  const freq = new Map<string, number>();
  for (const w of bodyText.toLowerCase().match(/[a-z]{4,}/g) || []) {
    if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topTerms = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  const slop = analyzeAiWritingTells(bodyText.slice(0, 8_000));
  const hasFaqOrQuestionH2 = h2s.some((h) => /\?|\b(how|what|why|vs|compare|cost|guide|faq)\b/i.test(h));

  const checks: SeoCheckItem[] = [
    {
      id: 'title',
      category: 'on-page',
      label: 'Title Tag Length & Presence (30–60 chars)',
      status: !title ? 'fail' : title.length >= 30 && title.length <= 65 ? 'pass' : 'warn',
      detail: title ? `"${title}" (${title.length} chars)` : 'Missing <title> tag',
      weight: 14,
    },
    {
      id: 'meta-desc',
      category: 'on-page',
      label: 'Meta Description (120–160 chars)',
      status: !metaDescription ? 'fail' : metaDescription.length >= 110 && metaDescription.length <= 165 ? 'pass' : 'warn',
      detail: metaDescription ? `${metaDescription.length} chars` : 'Missing meta description',
      weight: 12,
    },
    {
      id: 'h1',
      category: 'on-page',
      label: 'Single Clear H1 Heading',
      status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn',
      detail: h1s.length === 1 ? `"${h1s[0]}"` : `${h1s.length} H1 tags found`,
      weight: 12,
    },
    {
      id: 'heading-hierarchy',
      category: 'on-page',
      label: 'Section Subheadings (H2/H3)',
      status: h2s.length >= 2 ? 'pass' : h2s.length === 1 ? 'warn' : 'fail',
      detail: `${h2s.length} H2, ${h3s.length} H3 headings`,
      weight: 8,
    },
    {
      id: 'canonical',
      category: 'technical',
      label: 'Canonical URL Tag',
      status: canonical ? 'pass' : 'warn',
      detail: canonical || 'No <link rel="canonical"> declared',
      weight: 8,
    },
    {
      id: 'viewport',
      category: 'technical',
      label: 'Mobile Viewport Meta',
      status: viewportMatch ? 'pass' : 'fail',
      detail: viewportMatch ? 'Responsive viewport configured' : 'Missing mobile viewport meta',
      weight: 6,
    },
    {
      id: 'json-ld',
      category: 'schema-social',
      label: 'JSON-LD Structured Data Schema',
      status: jsonLdBlocks.length > 0 ? 'pass' : 'warn',
      detail: jsonLdBlocks.length > 0 ? `${jsonLdBlocks.length} JSON-LD schema block(s)` : 'Add Organization, Product, Article, or FAQPage JSON-LD',
      weight: 10,
    },
    {
      id: 'open-graph',
      category: 'schema-social',
      label: 'OpenGraph & Social Cards',
      status: ogTags.length >= 3 ? 'pass' : ogTags.length > 0 ? 'warn' : 'fail',
      detail: `${ogTags.length} og:* tags, ${twitterTags.length} twitter:* tags`,
      weight: 8,
    },
    {
      id: 'img-alt',
      category: 'content-quality',
      label: 'Image Alt Attributes',
      status: imgTags.length === 0 || imgsMissingAlt === 0 ? 'pass' : 'warn',
      detail: imgTags.length ? `${imgTags.length - imgsMissingAlt}/${imgTags.length} images have alt text` : 'No <img> elements inspected',
      weight: 6,
    },
    {
      id: 'ai-visibility',
      category: 'ai-visibility',
      label: 'AI Search Visibility (GEO / Answer-Ready H2s + Entity Density)',
      status: hasFaqOrQuestionH2 && wordCount >= 300 ? 'pass' : wordCount >= 150 ? 'warn' : 'fail',
      detail: hasFaqOrQuestionH2
        ? `Answer-engine ready headings + ${wordCount} words`
        : `Add direct Q&A H2 subheadings and comparison tables for ChatGPT/Perplexity/AI Overviews (${wordCount} words)`,
      weight: 10,
    },
    {
      id: 'deslop',
      category: 'content-quality',
      label: 'OpenSEO Deslop / Humanizer Copy Check',
      status: slop.aiSlopScore <= 15 ? 'pass' : slop.aiSlopScore <= 40 ? 'warn' : 'fail',
      detail: `AI-tell score ${slop.aiSlopScore}/100 (${slop.hits.length} pattern classes flagged)`,
      weight: 6,
    },
  ];

  let earned = 0;
  let totalWeight = 0;
  for (const c of checks) {
    totalWeight += c.weight;
    if (c.status === 'pass') earned += c.weight;
    else if (c.status === 'warn') earned += c.weight * 0.5;
  }
  const overallScore = Math.round((earned / Math.max(1, totalWeight)) * 100);

  return {
    score: overallScore,
    overallScore,
    url: sourceUrl,
    sourceUrl,
    title,
    metaDescription,
    canonical,
    wordCount,
    headings: {
      h1: h1s,
      h2: h2s.slice(0, 12),
      h3: h3s.slice(0, 12),
    },
    links: {
      internal: internalLinks,
      external: externalLinks,
    },
    schemaCount: jsonLdBlocks.length,
    openGraph: Object.fromEntries(ogTags.map((tag, idx) => [`og_${idx + 1}`, tag])),
    aiSlopScore: slop.aiSlopScore,
    metadata: {
      title,
      metaDescription,
      canonical,
      robots: robots || 'index, follow (implicit)',
      wordCount,
      h1s,
      h2s: h2s.slice(0, 12),
      h3Count: h3s.length,
      internalLinks,
      externalLinks,
      imageCount: imgTags.length,
      imgsMissingAlt,
      jsonLdCount: jsonLdBlocks.length,
      ogCount: ogTags.length,
      keywordTarget: kw || null,
      keywordOccurrences: kwOccurrences,
      keywordDensityPct: kwDensity,
      aiSlopScore: slop.aiSlopScore,
    },
    topTerms,
    checks,
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'JSON object required' }, { status: 400 });
    }

    const rawHtml = typeof body.html === 'string' ? body.html.trim() : '';
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';

    if (rawHtml) {
      const report = analyzeHtmlDocument(rawHtml.slice(0, 500_000), rawUrl || 'https://pasted-document.local', keyword);
      return NextResponse.json({ data: { ...report, fetchMode: 'pasted-html' } });
    }

    if (!rawUrl) {
      return NextResponse.json({ error: 'Provide either a public URL or raw HTML to audit' }, { status: 400 });
    }

    const ssrfCheck = await isUrlSafe(rawUrl);
    if (!ssrfCheck.allowed) {
      return NextResponse.json({ error: ssrfCheck.reason || 'Invalid or disallowed URL' }, { status: 400 });
    }

    try {
      const resp = await safeFetchText(rawUrl, {
        headers: { 'User-Agent': 'MarketingOS-OpenSEO-Audit/2.0 (+https://marketingos.local)' },
        timeoutMs: 12_000,
      });
      if (!resp.ok) {
        return NextResponse.json({ error: `Target URL returned HTTP ${resp.status}` }, { status: 502 });
      }
      const html = (await resp.text()).slice(0, 500_000);
      const report = analyzeHtmlDocument(html, rawUrl, keyword);
      return NextResponse.json({ data: { ...report, fetchMode: 'live-crawl' } });
    } catch {
      return NextResponse.json(
        {
          error:
            'Target host could not be reached from this network environment. Paste the page HTML directly into the HTML Audit tab to run the full 11-check OpenSEO + AI Visibility analysis offline.',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('[POST /api/seo/crawl]', error);
    return NextResponse.json({ error: 'SEO audit failed' }, { status: 500 });
  }
}
