import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'local-tts.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loadedModule, loadedModule.exports);
const { generateLocalSpeech } = loadedModule.exports;

function preserveEnvironment(t, names) {
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('local TTS adapter does not call a provider when it is not configured', async (t) => {
  preserveEnvironment(t, ['LOCAL_TTS_BASE_URL', 'LOCAL_TTS_MODEL', 'LOCAL_TTS_VOICE', 'LOCAL_TTS_API_KEY']);
  delete process.env.LOCAL_TTS_BASE_URL;
  assert.equal(await generateLocalSpeech('Hello there', 'default'), null);
});

test('local TTS adapter calls the configured OpenAI-compatible service and returns audio bytes', async (t) => {
  preserveEnvironment(t, ['LOCAL_TTS_BASE_URL', 'LOCAL_TTS_MODEL', 'LOCAL_TTS_VOICE', 'LOCAL_TTS_API_KEY']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  process.env.LOCAL_TTS_BASE_URL = 'http://127.0.0.1:8880';
  process.env.LOCAL_TTS_MODEL = 'kokoro-test';
  process.env.LOCAL_TTS_VOICE = 'voice_configured';
  process.env.LOCAL_TTS_API_KEY = 'test-secret';
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init, body: JSON.parse(String(init.body)) };
    return new Response(Buffer.from('fake-mp3-data'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };

  const result = await generateLocalSpeech('A short test sentence.', 'default');
  assert.equal(captured.url, 'http://127.0.0.1:8880/v1/audio/speech');
  assert.equal(captured.init.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(captured.body, {
    model: 'kokoro-test',
    input: 'A short test sentence.',
    voice: 'voice_configured',
    response_format: 'mp3',
  });
  assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(result.audioDataUrl, `data:audio/mpeg;base64,${Buffer.from('fake-mp3-data').toString('base64')}`);
});

test('local TTS adapter rejects non-audio responses', async (t) => {
  preserveEnvironment(t, ['LOCAL_TTS_BASE_URL']);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  process.env.LOCAL_TTS_BASE_URL = 'http://127.0.0.1:8880';
  globalThis.fetch = async () => new Response('not audio', { status: 200, headers: { 'content-type': 'text/plain' } });
  await assert.rejects(generateLocalSpeech('Hello', 'default'), /unsupported audio type/);
});
