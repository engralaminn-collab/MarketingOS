import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'marketing-studio.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loadedModule, loadedModule.exports);
const {
  bestButtonTextColor,
  buildMarketingKit,
  buttonCodeExports,
  buttonEmailVml,
  buttonHtml,
  contrastRatio,
  DEFAULT_KIT_FORM,
  DIAGRAM_PRESETS,
  exportInteractiveArchifyHtml,
  importDiagramSourceToNodes,
  KIT_TYPES,
  normalizeHexColor,
  reimagineSourceContent,
  renderEditorialDiagramSvg,
  safeButtonHref,
  softButtonBackground,
} = loadedModule.exports;

test('diagram presets include the 7 foundational layouts plus the full 48 editorial SVG grammars', () => {
  assert.deepEqual(DIAGRAM_PRESETS.slice(0, 7).map((preset) => preset.id), [
    'journey', 'flow', 'funnel', 'timeline', 'quadrant', 'flywheel', 'service_blueprint',
  ]);
  assert.equal(DIAGRAM_PRESETS.length, 48);
  for (const preset of DIAGRAM_PRESETS) {
    assert.ok(preset.nodes.length >= 3, `${preset.id} should have starter nodes`);
    assert.ok(preset.nodes.every((node) => node.title && node.detail));
    const svg = renderEditorialDiagramSvg({
      type: preset.id,
      title: preset.title,
      accent: '#bf4520',
      nodes: preset.nodes,
    });
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<\/svg>$/);
  }
  assert.ok(DIAGRAM_PRESETS.find((preset) => preset.id === 'service_blueprint').nodes.every((node) => node.frontstage && node.backstage));
});

test('Mermaid, Draw.io, and Excalidraw importers convert diagrams and Archify exports standalone HTML', () => {
  const mmd = importDiagramSourceToNodes('flowchart LR\n  A[Capture Lead] --> B[Enrich Domain] --> C[Book Demo]');
  assert.equal(mmd.detectedFormat, 'mermaid');
  assert.ok(mmd.nodes.length >= 3);

  const drawio = importDiagramSourceToNodes('<mxfile><mxCell id="1" value="Landing Page: Hero"/><mxCell id="2" value="Checkout: Stripe"/></mxfile>');
  assert.equal(drawio.detectedFormat, 'drawio');
  assert.equal(drawio.nodes.length, 2);

  const archifyHtml = exportInteractiveArchifyHtml({
    type: 'architecture',
    title: 'Interactive Stack',
    accent: '#bf4520',
    nodes: mmd.nodes,
  });
  assert.match(archifyHtml, /Archify Interactive Inspector/);
  assert.match(archifyHtml, /<!DOCTYPE html>/);
});

test('specialized campaign kits and 52 marketingskills catalog include actionable measurement and claim safeguards', () => {
  assert.ok(KIT_TYPES.length >= 60);
  const cases = [
    ['seo_content_brief', /not live SEO data/i, /organic visits/i, /opt-out rate/i],
    ['cro_experiment', /no conversion lift is predicted/i, /conversion rate/i, /stopping rule/i],
    ['case_study', /written permission/i, /attribution window/i, /complaint rate/i],
    ['referral_campaign', /anti-spam terms/i, /consented referrals/i, /eligibility/i],
    ['programmatic-seo', /not live SEO data/i, /organic visits/i, /opt-out rate/i],
    ['ab-testing', /no conversion lift is predicted/i, /conversion rate/i, /stopping rule/i],
  ];

  for (const [type, reviewPattern, metricPattern, guardrailPattern] of cases) {
    const kit = buildMarketingKit({
      ...DEFAULT_KIT_FORM,
      type,
      brand: 'North Star',
      product: 'A useful service',
      audience: 'Independent teams',
      description: 'A concise description of the service.',
      goal: 'Make a more informed choice',
      offer: 'Book a conversation',
    });
    assert.match(kit.outputs.reviewNote, reviewPattern, type);
    assert.match(kit.outputs.primaryKpi, metricPattern, type);
    assert.match(kit.outputs.guardrails.join(' '), guardrailPattern, type);
    assert.ok(kit.outputs.guardrails.length >= 3, type);
    assert.ok(Array.isArray(kit.outputs.skillPlaybook) && kit.outputs.skillPlaybook.length >= 3, type);
    assert.equal(kit.form.type, type);
  }
});

test('CTA generation supports 12 variants, Outlook VML, escapes user content, and rejects unsafe destinations', () => {
  const html = buttonHtml({
    label: '<Start & go>',
    href: 'https://example.com/path?a=1&b=2',
    accent: '#123456',
    variant: 'solid',
    size: 'standard',
    corners: 'rounded',
  });
  assert.match(html, /&lt;Start &amp; go&gt;/);
  assert.match(html, /href="https:\/\/example\.com\/path\?a=1&amp;b=2"/);
  assert.equal(safeButtonHref('javascript:alert(1)'), null);
  assert.equal(safeButtonHref('data:text/html,evil'), null);
  assert.equal(safeButtonHref('/campaign'), '/campaign');
  assert.equal(safeButtonHref('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.throws(() => buttonHtml({
    label: 'Open', href: 'javascript:alert(1)', accent: '#123456', variant: 'solid', size: 'standard', corners: 'rounded',
  }), /Use an HTTPS/);

  const vml = buttonEmailVml({
    label: 'Book Consultation',
    href: 'https://example.com/book',
    accent: '#bf4520',
    size: 'large',
    corners: 'pill',
  });
  assert.match(vml, /v:roundrect/);

  const exportsBundle = buttonCodeExports({
    version: 1,
    label: 'Get Started',
    href: '/signup',
    accent: '#bf4520',
    variant: 'pill-badge',
    size: 'standard',
    corners: 'pill',
  });
  assert.ok(exportsBundle.tailwind.includes('rounded-full'));
  assert.ok(exportsBundle.reactComponent.includes('export function CampaignCta'));
  assert.ok(exportsBundle.cssTokens.includes('--cta-accent'));
});

test('CTA palette tokens are normalized and Reimagine-It preserves source facts across 3 visual directions', () => {
  assert.equal(normalizeHexColor('fFaa00'), '#ffaa00');
  assert.equal(normalizeHexColor('red; color: red'), '#bf4520');
  assert.equal(softButtonBackground('#000000'), '#e5e5e5');
  assert.equal(bestButtonTextColor('#000000'), '#ffffff');
  assert.ok(contrastRatio('#111111', softButtonBackground('#bf4520')) > 4.5);

  const reimagined = reimagineSourceContent('# Q4 Growth Report\n- 42% increase in SQL pipeline\nWe reduced onboarding time to 6 minutes.\n[Read Full Study](https://example.com/study)');
  assert.equal(reimagined.directions.length, 3);
  assert.ok(reimagined.extractedBrief.factsAndMetrics.some((f) => f.includes('42%')));
  assert.match(reimagined.directions[0].html, /42% increase in SQL pipeline/);
});
