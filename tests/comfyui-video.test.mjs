import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
const { generateWithComfyUIVideo } = loadedModule.exports;

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

function preserveEnvironment(t, names) {
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('ComfyUI video adapter substitutes prompt and render parameters, polls, and downloads a video', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'marketingos-video-test-'));
  const workflowPath = join(tempDir, 'workflow.json');
  await writeFile(workflowPath, JSON.stringify({
    '1': { class_type: 'TextConditioning', inputs: { text: '{{PROMPT}}', negative: '{{NEGATIVE_PROMPT}}' } },
    '2': { class_type: 'VideoFrames', inputs: { frames: '{{FRAMES}}', fps: '{{FPS}}', width: '{{WIDTH}}', height: '{{HEIGHT}}', duration: '{{DURATION}}', seed: '{{SEED}}' } },
    '3': { class_type: 'SaveVideo', inputs: { filename_prefix: 'test' } },
  }));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  let capturedWorkflow;
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/prompt') {
      try {
        const body = await readJson(request);
        capturedWorkflow = body.prompt;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ prompt_id: 'video-smoke-job' }));
      } catch (error) {
        response.writeHead(500);
        response.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (request.method === 'GET' && request.url === '/history/video-smoke-job') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        'video-smoke-job': {
          status: { status_str: 'success' },
          outputs: { '3': { videos: [{ filename: 'clip.mp4', subfolder: '', type: 'output' }] } },
        },
      }));
      return;
    }
    if (request.method === 'GET' && request.url.startsWith('/view?')) {
      response.writeHead(200, { 'Content-Type': 'video/mp4' });
      response.end(Buffer.from('fake-video-bytes'));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));

  preserveEnvironment(t, [
    'COMFYUI_BASE_URL', 'COMFYUI_VIDEO_WORKFLOW_FILE', 'COMFYUI_API_KEY',
    'COMFYUI_VIDEO_FPS', 'COMFYUI_VIDEO_WIDTH', 'COMFYUI_VIDEO_HEIGHT',
  ]);
  process.env.COMFYUI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.COMFYUI_VIDEO_WORKFLOW_FILE = workflowPath;
  process.env.COMFYUI_VIDEO_FPS = '12';
  process.env.COMFYUI_VIDEO_WIDTH = '640';
  process.env.COMFYUI_VIDEO_HEIGHT = '384';

  const result = await generateWithComfyUIVideo('An amber bottle in soft morning light', 5);
  assert.equal(result, `data:video/mp4;base64,${Buffer.from('fake-video-bytes').toString('base64')}`);
  assert.equal(capturedWorkflow['1'].inputs.text, 'An amber bottle in soft morning light');
  assert.equal(capturedWorkflow['1'].inputs.negative, 'flicker, jitter, distorted anatomy, text artifacts, watermark, low quality');
  assert.equal(capturedWorkflow['2'].inputs.frames, 60);
  assert.equal(capturedWorkflow['2'].inputs.fps, 12);
  assert.equal(capturedWorkflow['2'].inputs.width, 640);
  assert.equal(capturedWorkflow['2'].inputs.height, 384);
  assert.equal(capturedWorkflow['2'].inputs.duration, 5);
  assert.equal(Number.isInteger(capturedWorkflow['2'].inputs.seed), true);
});

test('ComfyUI video adapter does not call ComfyUI without a workflow configuration', async (t) => {
  preserveEnvironment(t, ['COMFYUI_VIDEO_WORKFLOW_FILE']);
  delete process.env.COMFYUI_VIDEO_WORKFLOW_FILE;
  assert.equal(await generateWithComfyUIVideo('prompt', 5), null);
});
