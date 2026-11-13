import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'firecrawl-scraper.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loadedModule, loadedModule.exports);
const { FirecrawlScrapeError, scrapeWithFirecrawl } = loadedModule.exports;

function preserveEnvironment(t, names) {
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('Firecrawl adapter is opt-in and has no hidden hosted default', async (t) => {
  preserveEnvironment(t, ['FIRECRAWL_BASE_URL', 'FIRECRAWL_API_KEY']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  delete process.env.FIRECRAWL_BASE_URL;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error('should not be called'); };
  assert.equal(await scrapeWithFirecrawl('https://example.com', 'summary'), null);
  assert.equal(requests, 0);
});

test('Firecrawl adapter sends an explicit request to the configured service', async (t) => {
  preserveEnvironment(t, ['FIRECRAWL_BASE_URL', 'FIRECRAWL_API_KEY']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  process.env.FIRECRAWL_BASE_URL = 'http://firecrawl:3002';
  process.env.FIRECRAWL_API_KEY = 'test-key';
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init, body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({
      success: true,
      data: {
        markdown: '# Example page\n\nUseful content.',
        html: '<html><title>Example page</title></html>',
        metadata: { title: 'Example page', description: 'A useful example.', sourceURL: 'https://example.com/' },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await scrapeWithFirecrawl('https://example.com/path', 'full');
  assert.equal(captured.url, 'http://firecrawl:3002/v2/scrape');
  assert.equal(captured.init.headers.Authorization, 'Bearer test-key');
  assert.equal(captured.body.url, 'https://example.com/path');
  assert.deepEqual(captured.body.formats, ['markdown', 'html']);
  assert.equal(captured.body.onlyMainContent, true);
  assert.equal(result.markdown, '# Example page\n\nUseful content.');
  assert.equal(result.metadata.title, 'Example page');
  assert.equal(result.sourceUrl, 'https://example.com/');
});

test('metadata mode avoids requesting page Markdown', async (t) => {
  preserveEnvironment(t, ['FIRECRAWL_BASE_URL', 'FIRECRAWL_API_KEY']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  process.env.FIRECRAWL_BASE_URL = 'http://firecrawl:3002';
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ success: true, data: { html: '<title>Meta</title>', metadata: { title: 'Meta' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await scrapeWithFirecrawl('https://example.com', 'metadata');
  assert.deepEqual(body.formats, ['html']);
});

test('Firecrawl response size and service configuration fail closed', async (t) => {
  preserveEnvironment(t, ['FIRECRAWL_BASE_URL', 'FIRECRAWL_API_KEY']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  process.env.FIRECRAWL_BASE_URL = 'https://api.example.com';
  globalThis.fetch = async () => new Response('oversized', {
    status: 200,
    headers: { 'content-type': 'application/json', 'content-length': String(3 * 1024 * 1024) },
  });
  await assert.rejects(scrapeWithFirecrawl('https://example.com', 'summary'), (error) => error instanceof FirecrawlScrapeError && error.code === 'TOO_LARGE');

  process.env.FIRECRAWL_BASE_URL = 'file:///tmp/firecrawl';
  await assert.rejects(scrapeWithFirecrawl('https://example.com', 'summary'), (error) => error instanceof FirecrawlScrapeError && error.code === 'CONFIG');
});
