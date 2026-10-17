const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const SCRAPE_TIMEOUT_MS = 25_000;

export type ScrapeMode = 'summary' | 'metadata' | 'full';

export interface FirecrawlPage {
  markdown: string;
  html: string;
  metadata: Record<string, unknown>;
  sourceUrl: string;
}

export class FirecrawlScrapeError extends Error {
  constructor(message: string, readonly code: 'CONFIG' | 'TIMEOUT' | 'TOO_LARGE' | 'RESPONSE' | 'PROVIDER' = 'PROVIDER') {
    super(message);
    this.name = 'FirecrawlScrapeError';
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new FirecrawlScrapeError('Firecrawl response exceeds the 2 MB limit', 'TOO_LARGE');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new FirecrawlScrapeError('Firecrawl response exceeds the 2 MB limit', 'TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function parseBaseUrl(input: string): URL {
  let base: URL;
  try {
    base = new URL(input);
  } catch {
    throw new FirecrawlScrapeError('FIRECRAWL_BASE_URL must be an absolute HTTP(S) service URL', 'CONFIG');
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new FirecrawlScrapeError('FIRECRAWL_BASE_URL must be an HTTP(S) URL without credentials, query or fragment', 'CONFIG');
  }
  return base;
}

/**
 * Calls only the operator-configured Firecrawl service. There is deliberately
 * no hosted default and no direct-fetch fallback if this service fails.
 */
export async function scrapeWithFirecrawl(url: string, mode: ScrapeMode): Promise<FirecrawlPage | null> {
  const configuredBase = process.env.FIRECRAWL_BASE_URL?.trim();
  if (!configuredBase) return null;

  const target = new URL(url);
  const base = parseBaseUrl(configuredBase);
  const endpoint = new URL('/v2/scrape', base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Firecrawl request timed out')), SCRAPE_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        url: target.toString(),
        formats: mode === 'metadata' ? ['html'] : ['markdown', 'html'],
        onlyMainContent: true,
        timeout: 20_000,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    let raw: string;
    try {
      raw = await readLimitedText(response);
    } catch (error) {
      if (error instanceof FirecrawlScrapeError) throw error;
      throw new FirecrawlScrapeError('Could not read the Firecrawl response', 'RESPONSE');
    }
    if (!response.ok) {
      throw new FirecrawlScrapeError(`Firecrawl rejected the scrape (HTTP ${response.status})`, 'PROVIDER');
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new FirecrawlScrapeError('Firecrawl returned a non-JSON response', 'RESPONSE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new FirecrawlScrapeError('Firecrawl returned invalid JSON', 'RESPONSE');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new FirecrawlScrapeError('Firecrawl returned an invalid payload', 'RESPONSE');
    }

    const root = parsed as { success?: boolean; data?: unknown; error?: unknown };
    if (root.success === false || root.error) {
      throw new FirecrawlScrapeError('Firecrawl could not scrape the requested page', 'PROVIDER');
    }
    const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {};
    const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? data.metadata as Record<string, unknown>
      : {};
    const markdown = typeof data.markdown === 'string' ? data.markdown : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!markdown && !html && !Object.keys(metadata).length) {
      throw new FirecrawlScrapeError('Firecrawl returned no page content', 'RESPONSE');
    }

    const sourceUrl = typeof metadata.sourceURL === 'string' ? metadata.sourceURL : target.toString();
    return { markdown, html, metadata, sourceUrl };
  } catch (error) {
    if (error instanceof FirecrawlScrapeError) throw error;
    if (controller.signal.aborted) {
      throw new FirecrawlScrapeError('Firecrawl request timed out', 'TIMEOUT');
    }
    throw new FirecrawlScrapeError('Could not reach the configured Firecrawl service', 'PROVIDER');
  } finally {
    clearTimeout(timeout);
  }
}
