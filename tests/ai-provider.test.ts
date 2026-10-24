import { afterEach, describe, expect, it } from 'bun:test';
import {
  generateChatCompletion,
  generateLocalImage,
  generateLocalSpeech,
  generateLocalVideo,
  getAiProviderConfig,
  normalizeProviderBaseUrl,
} from '../src/lib/ai-provider';

const originalFetch = globalThis.fetch;
const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL,
  AI_REQUEST_TIMEOUT_MS: process.env.AI_REQUEST_TIMEOUT_MS,
  AI_COMPATIBLE_BASE_URL: process.env.AI_COMPATIBLE_BASE_URL,
  AI_COMPATIBLE_MODEL: process.env.AI_COMPATIBLE_MODEL,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('self-hosted AI provider', () => {
  it('defaults to Ollama and explicitly disables automatic paid fallback', () => {
    delete process.env.AI_PROVIDER;
    delete process.env.OLLAMA_CHAT_MODEL;
    const config = getAiProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.model).toBe('qwen2.5:7b');
    expect(config.automaticPaidFallback).toBe(false);
  });

  it('calls the configured local Ollama endpoint and returns its answer', async () => {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    process.env.OLLAMA_CHAT_MODEL = 'unit-test-model';
    let requestedUrl = '';
    let requestBody: any;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        model: 'unit-test-model',
        message: { content: 'A locally generated answer.' },
        prompt_eval_count: 12,
        eval_count: 7,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const result = await generateChatCompletion([
      { role: 'user', content: 'Test prompt' },
    ]);

    expect(requestedUrl).toBe('http://127.0.0.1:11434/api/chat');
    expect(requestBody.model).toBe('unit-test-model');
    expect(requestBody.stream).toBe(false);
    expect(result.content).toBe('A locally generated answer.');
    expect(result.promptTokens).toBe(12);
    expect(result.completionTokens).toBe(7);
  });

  it('fails closed when local inference is unavailable instead of calling a cloud fallback', async () => {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount++;
      throw new Error('connection refused');
    }) as typeof fetch;

    await expect(generateChatCompletion([
      { role: 'user', content: 'Do not fall back to a cloud provider' },
    ])).rejects.toThrow('Self-hosted AI provider "ollama" is unreachable');
    expect(requestCount).toBe(1);
  });

  it('rejects unknown provider names rather than silently choosing a different provider', async () => {
    process.env.AI_PROVIDER = 'automatic-cloud-fallback';
    await expect(generateChatCompletion([
      { role: 'user', content: 'test' },
    ])).rejects.toThrow('Unsupported AI_PROVIDER');
  });

  it('normalizes trailing slashes and rejects non-HTTP or credentialed provider URLs', () => {
    expect(normalizeProviderBaseUrl('http://127.0.0.1:7860///', 'IMAGE_GENERATION_URL')).toBe('http://127.0.0.1:7860');
    expect(normalizeProviderBaseUrl('https://inference.internal.example/v1/', 'AI_COMPATIBLE_BASE_URL')).toBe('https://inference.internal.example/v1');
    expect(() => normalizeProviderBaseUrl('ftp://127.0.0.1:21', 'IMAGE_GENERATION_URL')).toThrow('must use http or https');
    expect(() => normalizeProviderBaseUrl('http://user:secret@127.0.0.1:7860', 'IMAGE_GENERATION_URL')).toThrow('must not embed credentials');
  });

  it('local media helpers strip trailing slashes and fail closed when unconfigured', async () => {
    delete process.env.VIDEO_GENERATION_URL;
    delete process.env.TTS_SERVICE_URL;
    await expect(generateLocalVideo('test clip')).rejects.toThrow('VIDEO_GENERATION_URL is not configured');
    await expect(generateLocalSpeech('hello')).rejects.toThrow('TTS_SERVICE_URL is not configured');

    const prevImgUrl = process.env.IMAGE_GENERATION_URL;
    process.env.IMAGE_GENERATION_URL = 'http://127.0.0.1:7860///';
    let calledUrl = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify({ images: ['iVBORw0KGgo='] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const img = await generateLocalImage('editorial product shot', '1024x1024');
    expect(calledUrl).toBe('http://127.0.0.1:7860/sdapi/v1/txt2img');
    expect(img.dataUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
    if (prevImgUrl === undefined) delete process.env.IMAGE_GENERATION_URL;
    else process.env.IMAGE_GENERATION_URL = prevImgUrl;
  });
});
