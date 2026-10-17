import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'comfyui.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loadedModule, loadedModule.exports);
const { generateWithComfyUI } = loadedModule.exports;

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=',
  'base64',
);

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { data += chunk; });
    request.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

test('ComfyUI image adapter submits, polls, downloads, and returns one local image', async (t) => {
  let capturedWorkflow;
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/prompt') {
      try {
        assert.equal(request.headers.authorization, 'Bearer test-secret');
        const body = await readJson(request);
        capturedWorkflow = body.prompt;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ prompt_id: 'smoke-job' }));
      } catch (error) {
        response.writeHead(500);
        response.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    if (request.method === 'GET' && request.url === '/history/smoke-job') {
      assert.equal(request.headers.authorization, 'Bearer test-secret');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        'smoke-job': {
          status: { status_str: 'success' },
          outputs: { '7': { images: [{ filename: 'local.png', subfolder: '', type: 'output' }] } },
        },
      }));
      return;
    }

    if (request.method === 'GET' && request.url.startsWith('/view?')) {
      assert.equal(request.headers.authorization, 'Bearer test-secret');
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(ONE_PIXEL_PNG);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const original = {
    url: process.env.COMFYUI_BASE_URL,
    checkpoint: process.env.COMFYUI_IMAGE_CHECKPOINT,
    key: process.env.COMFYUI_API_KEY,
  };
  t.after(() => {
    if (original.url === undefined) delete process.env.COMFYUI_BASE_URL;
    else process.env.COMFYUI_BASE_URL = original.url;
    if (original.checkpoint === undefined) delete process.env.COMFYUI_IMAGE_CHECKPOINT;
    else process.env.COMFYUI_IMAGE_CHECKPOINT = original.checkpoint;
    if (original.key === undefined) delete process.env.COMFYUI_API_KEY;
    else process.env.COMFYUI_API_KEY = original.key;
  });

  const { port } = server.address();
  process.env.COMFYUI_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.COMFYUI_IMAGE_CHECKPOINT = 'test-checkpoint.safetensors';
  process.env.COMFYUI_API_KEY = 'test-secret';

  const result = await generateWithComfyUI('A clean product hero image', 768, 1344);
  assert.ok(result.startsWith('data:image/png;base64,'));
  assert.equal(capturedWorkflow['1'].inputs.ckpt_name, 'test-checkpoint.safetensors');
  assert.equal(capturedWorkflow['2'].inputs.text, 'A clean product hero image');
  assert.equal(capturedWorkflow['4'].inputs.width, 768);
  assert.equal(capturedWorkflow['4'].inputs.height, 1344);
  assert.equal(capturedWorkflow['4'].inputs.batch_size, 1);
});

test('ComfyUI adapter does not make a network request when no local server is configured', async (t) => {
  const originalUrl = process.env.COMFYUI_BASE_URL;
  const originalCheckpoint = process.env.COMFYUI_IMAGE_CHECKPOINT;
  delete process.env.COMFYUI_BASE_URL;
  delete process.env.COMFYUI_IMAGE_CHECKPOINT;
  t.after(() => {
    if (originalUrl === undefined) delete process.env.COMFYUI_BASE_URL;
    else process.env.COMFYUI_BASE_URL = originalUrl;
    if (originalCheckpoint === undefined) delete process.env.COMFYUI_IMAGE_CHECKPOINT;
    else process.env.COMFYUI_IMAGE_CHECKPOINT = originalCheckpoint;
  });
  assert.equal(await generateWithComfyUI('prompt', 512, 512), null);
});
