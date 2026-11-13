import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function loadTsModule(relPath) {
  const fullPath = path.resolve(process.cwd(), relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'module', transpiled.outputText);
  fn(mod.exports, mod);
  return mod.exports;
}

const stack = loadTsModule('src/lib/free-ai-stack.ts');

test('FREE_LLM_PROVIDERS covers all 16 configured free/local and compatible adapters', () => {
  assert.equal(stack.FREE_LLM_PROVIDERS.length, 16);
  const ids = new Set(stack.FREE_LLM_PROVIDERS.map((p) => p.id));
  for (const required of [
    'ollama',
    'groq',
    'gemini',
    'cerebras',
    'openrouter',
    'cloudflare',
    'sambanova',
    'chutes',
    'pollinations',
    'zhipu',
    'modelscope',
    'siliconflow',
    'mistral',
    'nvidia-nim',
    'huggingface',
    'openai-compatible',
  ]) {
    assert.ok(ids.has(required), `Missing provider: ${required}`);
  }
});

test('Embeddings, multimodal services, and MCP servers are registered', () => {
  assert.ok(stack.FREE_EMBEDDING_PROVIDERS.length >= 7);
  assert.ok(stack.FREE_SPEECH_AND_IMAGE_SERVICES.image.length >= 4);
  assert.ok(stack.FREE_SPEECH_AND_IMAGE_SERVICES.stt.length >= 4);
  assert.ok(stack.FREE_SPEECH_AND_IMAGE_SERVICES.tts.length >= 4);
  assert.ok(stack.FREE_INFRA_AND_FRAMEWORKS.mcpServers.length >= 20);
});

test('Local 128-dim semantic embeddings rank related concepts above unrelated ones', () => {
  const q = stack.computeLocalSemanticEmbedding('programmatic SEO schema markup canonical audit', 128);
  const near = stack.computeLocalSemanticEmbedding('SEO audit canonical tags and JSON-LD schema markup', 128);
  const far = stack.computeLocalSemanticEmbedding('payroll leave balance and tuition invoice receipt', 128);
  assert.equal(q.length, 128);
  const simNear = stack.cosineSimilarity(q, near);
  const simFar = stack.cosineSimilarity(q, far);
  assert.ok(simNear > simFar, `Expected ${simNear} > ${simFar}`);
});

test('ModelDeck telemetry and response cache track calls and hits accurately', () => {
  stack.recordProviderCall({
    provider: 'groq',
    latencyMs: 145,
    tokens: 320,
    cached: false,
  });
  stack.setCachedCompletion('test-key-1', {
    content: 'Cached response',
    model: 'llama-3.3-70b-versatile',
    provider: 'groq',
  });
  const hit = stack.getCachedCompletion('test-key-1');
  assert.equal(hit?.content, 'Cached response');

  const telemetry = stack.getModelDeckTelemetry();
  assert.equal(telemetry.length, 16);
  assert.ok(telemetry.some((p) => p.id === 'groq' && p.rpmUsed >= 1 && p.rpdUsed >= 1));
});

test('buildRunnableAgentCode exports runnable Python, Bash, and MCP JSON', () => {
  const bundle = stack.buildRunnableAgentCode({
    provider: 'openrouter',
    model: 'qwen/qwen3-32b:free',
    mcpServers: ['filesystem', 'playwright', 'memory'],
  });
  assert.ok(bundle.listFreePy.includes('openrouter.ai/api/v1/models'));
  assert.ok(bundle.agentPy.includes('call_with_fallback'));
  assert.ok(!bundle.agentPy.includes('Groq Fallback'));
  assert.throws(() => stack.buildRunnableAgentCode({ provider: 'openrouter', model: 'paid/model' }));
  assert.throws(() => stack.buildRunnableAgentCode({ provider: 'openrouter', model: 'x\"; unsafe()' }));
  assert.ok(bundle.ollamaSetupSh.includes('ollama pull'));
  const parsedMcp = JSON.parse(bundle.mcpConfigJson);
  assert.ok(parsedMcp.mcpServers.filesystem);
  assert.ok(parsedMcp.mcpServers.playwright);
});
