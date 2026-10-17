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
  buttonHtml,
  contrastRatio,
  DEFAULT_KIT_FORM,
  DIAGRAM_PRESETS,
  normalizeHexColor,
  safeButtonHref,
  softButtonBackground,
} = loadedModule.exports;

test('diagram presets cover seven semantic layouts with renderable starter nodes', () => {
  assert.deepEqual(DIAGRAM_PRESETS.map((preset) => preset.id), [
    'journey', 'flow', 'funnel', 'timeline', 'quadrant', 'flywheel', 'service_blueprint',
  ]);
  for (const preset of DIAGRAM_PRESETS) {
    assert.ok(preset.nodes.length >= 4, `${preset.id} should have enough starter nodes`);
    assert.ok(preset.nodes.every((node) => node.title && node.detail));
  }
  assert.ok(DIAGRAM_PRESETS.find((preset) => preset.id === 'service_blueprint').nodes.every((node) => node.frontstage && node.backstage));
});

test('specialized campaign kits include actionable measurement and claim safeguards', () => {
  const cases = [
    ['seo_content_brief', /not live SEO data/i, /organic visits/i, /opt-out rate/i],
    ['cro_experiment', /no conversion lift is predicted/i, /conversion rate/i, /stopping rule/i],
    ['case_study', /written permission/i, /attribution window/i, /complaint rate/i],
    ['referral_campaign', /anti-spam terms/i, /consented referrals/i, /eligibility/i],
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
    assert.equal(kit.form.type, type);
  }
});

test('CTA generation escapes user content and rejects unsafe destinations', () => {
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
});

test('CTA palette tokens are normalized and contrast uses the rendered soft fill', () => {
  assert.equal(normalizeHexColor('fFaa00'), '#ffaa00');
  assert.equal(normalizeHexColor('red; color: red'), '#bf4520');
  assert.equal(softButtonBackground('#000000'), '#e5e5e5');
  assert.equal(bestButtonTextColor('#000000'), '#ffffff');
  assert.ok(contrastRatio('#111111', softButtonBackground('#bf4520')) > 4.5);
  const safeColor = buttonHtml({
    label: 'Open', href: '/', accent: 'red; color: red', variant: 'solid', size: 'standard', corners: 'rounded',
  });
  assert.match(safeColor, /background:#bf4520/);
  assert.doesNotMatch(safeColor, /red; color/);
});
