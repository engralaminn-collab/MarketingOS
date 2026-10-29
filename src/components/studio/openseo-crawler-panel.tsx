'use client';

import React, { useState } from 'react';
import { CheckCircle2, Globe, Search, TriangleAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/hooks/use-api';

interface CrawlReport {
  overallScore: number;
  sourceUrl: string;
  fetchMode: string;
  metadata: {
    title: string;
    metaDescription: string;
    canonical: string;
    robots: string;
    wordCount: number;
    h1s: string[];
    h2s: string[];
    internalLinks: number;
    externalLinks: number;
    imageCount: number;
    imgsMissingAlt: number;
    jsonLdCount: number;
    ogCount: number;
    keywordTarget: string | null;
    keywordOccurrences: number;
    keywordDensityPct: number;
    aiSlopScore: number;
  };
  topTerms: Array<{ term: string; count: number }>;
  checks: Array<{
    id: string;
    category: string;
    label: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
  }>;
}

export function OpenSeoCrawlerPanel() {
  const [url, setUrl] = useState('https://github.com/every-app/open-seo');
  const [keyword, setKeyword] = useState('seo');
  const [rawHtml, setRawHtml] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState<CrawlReport | null>(null);

  async function runAudit(useSampleHtml = false) {
    setAuditing(true);
    try {
      const sample = useSampleHtml
        ? `<!DOCTYPE html><html><head><title>Sovereign MarketingOS — All-in-One SEO, CRM & Free AI Platform</title><meta name="description" content="Audit technical SEO, AI search visibility, CRM enrichment, and 52 campaign playbooks in one self-hosted MarketingOS workspace."/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="canonical" href="https://demo-agency.com/seo"/><meta property="og:title" content="Sovereign MarketingOS"/><meta property="og:description" content="OpenSEO + Free AI"/><meta property="og:type" content="website"/><script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"MarketingOS"}</script></head><body><h1>How MarketingOS Improves SEO & AI Search Visibility</h1><h2>What does the 11-check OpenSEO audit inspect?</h2><p>${'Technical SEO, JSON-LD structured data, internal linking, and clean human-written copy drive sustainable organic pipeline growth without paid ad lock-in. '.repeat(8)}</p><h2>How do teams optimize for ChatGPT and Perplexity citations?</h2><img src="https://demo-agency.com/diagram.svg" alt="Editorial SEO architecture diagram"/><a href="https://demo-agency.com/pricing">Pricing</a><a href="https://schema.org">Schema.org</a></body></html>`
        : rawHtml;

      const res = await apiFetch<{ data: CrawlReport }>('/api/seo/crawl', {
        method: 'POST',
        body: JSON.stringify({ url, keyword, html: sample || undefined }),
      });
      setReport(res.data);
      toast.success(`OpenSEO score: ${res.data.overallScore}/100 (${res.data.fetchMode})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setAuditing(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-500" /> OpenSEO Live On-Page & AI Search Visibility Crawler (every-app/open-seo)
            </CardTitle>
            <CardDescription>
              Audits Title, Meta, H1–H3, Canonicals, OpenGraph, JSON-LD Schema, Alt attributes, Keyword Clusters, GEO/LLM Visibility & Deslop score.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => runAudit(true)} disabled={auditing}>
            Run Instant Demo HTML Audit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <Label className="text-xs">Public URL to Crawl</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/landing-page" />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Target Keyword</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. b2b crm software" />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button className="w-full" onClick={() => runAudit(false)} disabled={auditing}>
              <Search className="mr-1.5 h-4 w-4" /> {auditing ? 'Auditing...' : 'Audit'}
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">Optional: Paste Raw Page HTML (for staging/offline pages)</Label>
          <Textarea
            rows={2}
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
            placeholder="Paste <!DOCTYPE html>... here to run all 11 OpenSEO checks without network egress"
            className="text-xs font-mono"
          />
        </div>

        {report && (
          <div className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Overall SEO + GEO Score</div>
                <div className="text-2xl font-bold">{report.overallScore}/100</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Word Count & Density</div>
                <div className="text-lg font-bold">{report.metadata.wordCount} words</div>
                <div className="text-xs text-muted-foreground">Keyword: {report.metadata.keywordDensityPct}%</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Links & Schema</div>
                <div className="text-lg font-bold">{report.metadata.internalLinks} int / {report.metadata.externalLinks} ext</div>
                <div className="text-xs text-muted-foreground">{report.metadata.jsonLdCount} JSON-LD · {report.metadata.ogCount} OG</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Deslop Copy Quality</div>
                <div className="text-lg font-bold">{100 - report.metadata.aiSlopScore}% Human</div>
                <div className="text-xs text-muted-foreground">Slop score: {report.metadata.aiSlopScore}/100</div>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {report.checks.map((c) => (
                <div key={c.id} className="rounded border p-2.5 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {c.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : c.status === 'warn' ? (
                      <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-muted-foreground">{c.detail}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{c.category}</Badge>
                </div>
              ))}
            </div>

            {report.topTerms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                <span className="font-semibold text-muted-foreground">Extracted Topic Clusters:</span>
                {report.topTerms.map((t) => (
                  <Badge key={t.term} variant="secondary">{t.term} ({t.count})</Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
