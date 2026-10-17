import { afterEach, describe, expect, it } from 'bun:test';
import { generateChatCompletion, getAiProviderConfig } from '../src/lib/ai-provider';

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
});
