/**
 * MarketingOS — Website Growth Engine (Requirement 9).
 *
 * Performs a real technical SEO audit of a connected website: technical SEO,
 * content gaps, landing-page recommendations, conversion optimization,
 * page-speed recommendations, structured-data issues, internal linking,
 * and lead-form optimization.
 *
 * The audit fetches the page HTML and analyzes it for real issues. AI may
 * draft content and SEO changes, but publishing material changes requires
 * authorized approval (via the approval engine).
 */
import { PrismaClient } from '@prisma/client';
import { isUrlSafe } from './ssrf';
const prisma = new PrismaClient();

export interface SeoAuditIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string; // technical_seo|content|performance|structured_data|conversion
  title: string;
  detail: string;
  recommendation: string;
}

export interface SeoAuditResult {
  url: string;
  overallScore: number; // 0-100
  issues: SeoAuditIssue[];
  recommendations: string[];
  pageSpeedScore?: number;
  contentGaps: string[];
  landingPageSuggestions: string[];
  conversionOptSuggestions: string[];
  structuredDataIssues: string[];
  internalLinkSuggestions: string[];
  leadFormOptSuggestions: string[];
}

/**
 * Run a real SEO audit on a URL.
 * Fetches the page and analyzes the HTML for common issues.
 */
export async function auditWebsite(companyId: string, url: string): Promise<SeoAuditResult> {
  // SSRF guard
  if (!isUrlSafe(url)) {
    throw new Error('URL is not safe to fetch (failed SSRF guard).');
  }

  const issues: SeoAuditIssue[] = [];
  const recommendations: string[] = [];
  const contentGaps: string[] = [];
  const landingPageSuggestions: string[] = [];
  const conversionOptSuggestions: string[] = [];
  const structuredDataIssues: string[] = [];
  const internalLinkSuggestions: string[] = [];
  const leadFormOptSuggestions: string[] = [];

  let html = '';
  let fetchOk = false;
  let responseTimeMs = 0;

  try {
    const start = Date.now();
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MarketingOS-SEO-Audit/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    responseTimeMs = Date.now() - start;
    fetchOk = res.ok;
    if (res.ok) {
      html = await res.text();
    } else {
      issues.push({
        severity: 'critical',
        category: 'technical_seo',
        title: `HTTP ${res.status} response`,
        detail: `The URL returned HTTP status ${res.status}. Search engines cannot index this page.`,
        recommendation: 'Fix the server to return HTTP 200 for this URL.',
      });
    }
  } catch (err: any) {
    issues.push({
      severity: 'critical',
      category: 'technical_seo',
      title: 'Fetch failed',
      detail: `Could not fetch the URL: ${err.message || 'unknown error'}`,
      recommendation: 'Verify the URL is accessible and the server is responding.',
    });
  }

  if (html) {
    // ── Title tag ──
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!titleMatch) {
      issues.push({
        severity: 'critical',
        category: 'technical_seo',
        title: 'Missing <title> tag',
        detail: 'The page has no <title> tag. This is essential for search rankings.',
        recommendation: 'Add a descriptive, keyword-rich <title> tag (50-60 characters).',
      });
    } else if (titleMatch[1].trim().length > 60) {
      issues.push({
        severity: 'warning',
        category: 'technical_seo',
        title: 'Title tag too long',
        detail: `Title is ${titleMatch[1].trim().length} characters — search engines truncate at ~60.`,
        recommendation: 'Shorten the title to 50-60 characters.',
      });
    }

    // ── Meta description ──
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (!descMatch) {
      issues.push({
        severity: 'warning',
        category: 'technical_seo',
        title: 'Missing meta description',
        detail: 'No meta description found. This affects click-through rate from search results.',
        recommendation: 'Add a compelling meta description (150-160 characters).',
      });
    } else if (descMatch[1].length > 160) {
      issues.push({
        severity: 'info',
        category: 'technical_seo',
        title: 'Meta description too long',
        detail: `Description is ${descMatch[1].length} characters — may be truncated.`,
        recommendation: 'Shorten to 150-160 characters.',
      });
    }

    // ── H1 tag ──
    const h1Matches = html.match(/<h1[^>]*>/gi);
    if (!h1Matches || h1Matches.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'content',
        title: 'Missing H1 heading',
        detail: 'The page has no H1 heading. Each page should have exactly one H1.',
        recommendation: 'Add a single, descriptive H1 heading containing the primary keyword.',
      });
    } else if (h1Matches.length > 1) {
      issues.push({
        severity: 'warning',
        category: 'content',
        title: 'Multiple H1 headings',
        detail: `Found ${h1Matches.length} H1 tags. Best practice is one H1 per page.`,
        recommendation: 'Use only one H1 heading; demote others to H2.',
      });
    }

    // ── Heading structure ──
    const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
    if (h2Count === 0) {
      contentGaps.push('No H2 subheadings — content may lack structure for readability and SEO.');
    }

    // ── Canonical ──
    if (!html.match(/<link[^>]+rel=["']canonical["']/i)) {
      issues.push({
        severity: 'warning',
        category: 'technical_seo',
        title: 'Missing canonical link',
        detail: 'No canonical URL specified. This can cause duplicate-content issues.',
        recommendation: 'Add a <link rel="canonical"> tag.',
      });
    }

    // ── Open Graph ──
    if (!html.match(/<meta[^>]+property=["']og:title["']/i)) {
      issues.push({
        severity: 'info',
        category: 'conversion',
        title: 'Missing Open Graph tags',
        detail: 'No OG tags found — social sharing will lack rich previews.',
        recommendation: 'Add og:title, og:description, and og:image meta tags.',
      });
    }

    // ── Structured data (JSON-LD) ──
    const jsonLdCount = (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length;
    if (jsonLdCount === 0) {
      structuredDataIssues.push('No JSON-LD structured data found — add Schema.org markup for richer search results.');
    }

    // ── Mobile viewport ──
    if (!html.match(/<meta[^>]+name=["']viewport["']/i)) {
      issues.push({
        severity: 'critical',
        category: 'technical_seo',
        title: 'Missing viewport meta tag',
        detail: 'No viewport meta tag — page is not mobile-friendly.',
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      });
    }

    // ── Internal links ──
    const internalLinks = (html.match(/<a[^>]+href=["']\/[^"']*["']/gi) || []).length;
    if (internalLinks < 3) {
      internalLinkSuggestions.push(`Only ${internalLinks} internal links found — add more contextual internal links to improve crawlability and distribute link equity.`);
    }

    // ── Lead form / conversion ──
    const hasForm = /<form/i.test(html);
    if (!hasForm) {
      leadFormOptSuggestions.push('No form found on this page — add a lead capture form with a clear call-to-action.');
      conversionOptSuggestions.push('No conversion mechanism (form/button) detected — add a primary CTA.');
    } else {
      // Check for common conversion issues
      if (!html.match(/<input[^>]+type=["']email["']/i)) {
        leadFormOptSuggestions.push('Form lacks an email input field — capture email for lead nurturing.');
      }
      if (!html.match(/<button[^>]*type=["']submit["']/i) && !html.match(/<input[^>]+type=["']submit["']/i)) {
        leadFormOptSuggestions.push('Form has no visible submit button — ensure the CTA is clear.');
      }
    }

    // ── Performance heuristics ──
    const htmlSize = html.length;
    if (htmlSize > 500000) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        title: 'Large page size',
        detail: `HTML is ${(htmlSize / 1024).toFixed(0)} KB — may slow page load.`,
        recommendation: 'Minify HTML, defer non-critical JS, and optimize images.',
      });
    }
    if (responseTimeMs > 2000) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        title: 'Slow server response',
        detail: `Server responded in ${responseTimeMs}ms — should be under 200ms.`,
        recommendation: 'Optimize server performance, use a CDN, and enable caching.',
      });
    }

    // ── Image alt text ──
    const imgCount = (html.match(/<img[^>]*>/gi) || []).length;
    const imgWithAlt = (html.match(/<img[^>]+alt=["'][^"']+["']/gi) || []).length;
    if (imgCount > 0 && imgWithAlt < imgCount) {
      issues.push({
        severity: 'warning',
        category: 'content',
        title: 'Images missing alt text',
        detail: `${imgCount - imgWithAlt} of ${imgCount} images lack alt text — hurts accessibility and image SEO.`,
        recommendation: 'Add descriptive alt text to all meaningful images.',
      });
    }

    // ── Content length ──
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(' ').filter(w => w.length > 0).length;
    if (wordCount < 300) {
      contentGaps.push(`Page has only ~${wordCount} words of text content — aim for 300+ words for topical depth.`);
      landingPageSuggestions.push('Expand content to at least 300-500 words covering the topic comprehensively.');
    }
  }

  // Calculate overall score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 20;
    else if (issue.severity === 'warning') score -= 8;
    else if (issue.severity === 'info') score -= 2;
  }
  score = Math.max(0, score);

  // Build recommendation list
  recommendations.push('Prioritize fixing all critical issues first.');
  if (issues.some(i => i.category === 'content')) {
    recommendations.push('Improve content depth and heading structure.');
  }
  if (issues.some(i => i.category === 'performance')) {
    recommendations.push('Optimize page speed — defer JS, compress images, use a CDN.');
  }
  if (structuredDataIssues.length > 0) {
    recommendations.push('Add Schema.org structured data for rich search results.');
  }
  if (leadFormOptSuggestions.length > 0) {
    recommendations.push('Optimize lead capture forms to improve conversion rate.');
  }

  const result: SeoAuditResult = {
    url,
    overallScore: score,
    issues,
    recommendations,
    contentGaps,
    landingPageSuggestions,
    conversionOptSuggestions,
    structuredDataIssues,
    internalLinkSuggestions,
    leadFormOptSuggestions,
  };

  // Persist the audit
  await prisma.websiteAudit.create({
    data: {
      url,
      auditType: 'full',
      overallScore: score,
      issues: JSON.stringify(issues),
      recommendations: JSON.stringify(recommendations),
      contentGaps: JSON.stringify(contentGaps),
      landingPageSuggestions: JSON.stringify(landingPageSuggestions),
      conversionOptSuggestions: JSON.stringify(conversionOptSuggestions),
      structuredDataIssues: JSON.stringify(structuredDataIssues),
      internalLinkSuggestions: JSON.stringify(internalLinkSuggestions),
      leadFormOptSuggestions: JSON.stringify(leadFormOptSuggestions),
      companyId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'seo.audit_completed',
      resource: 'website_audit',
      resourceId: url,
      details: `SEO audit completed for ${url}: score ${score}/100, ${issues.length} issues found.`,
      companyId,
    },
  }).catch(() => { /* non-blocking audit */ });

  return result;
}

/**
 * Get the most recent audit for a URL.
 */
export async function getLatestAudit(companyId: string, url: string) {
  return prisma.websiteAudit.findFirst({
    where: { companyId, url },
    orderBy: { auditedAt: 'desc' },
  });
}

/**
 * List all website audits for a company.
 */
export async function listWebsiteAudits(companyId: string, limit = 20) {
  return prisma.websiteAudit.findMany({
    where: { companyId },
    orderBy: { auditedAt: 'desc' },
    take: limit,
  });
}
