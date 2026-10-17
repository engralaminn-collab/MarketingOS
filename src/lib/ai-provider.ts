import ZAI from 'z-ai-web-dev-sdk';
import { getCompanyToolCredentials, ToolCredentialsError } from '@/lib/tool-credentials';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionResult = {
  content: string;
  provider: 'Ollama' | 'OpenRouter' | 'Z.AI';
  model: string | null;
};

const OPENROUTER_TOOL_NUMBER = 83;
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

function configuredProvider(): string {
  return (process.env.AI_PROVIDER || 'ollama').trim().toLowerCase();
}

function getOllamaConfig(): { baseUrl: URL; model: string; apiKey: string | null } {
  let baseUrl: URL;
  try {
    baseUrl = new URL(process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL);
  } catch {
    throw new Error('OLLAMA_BASE_URL must be a valid server URL.');
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('OLLAMA_BASE_URL must use HTTP(S) and must not include credentials, query parameters, or fragments.');
  }
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  if (model.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(model)) {
    throw new Error('OLLAMA_MODEL contains unsupported characters.');
  }
  const apiKey = process.env.OLLAMA_API_KEY?.trim() || null;
  return { baseUrl, model, apiKey };
}

function endpoint(baseUrl: URL, path: string): string {
  const prefix = baseUrl.pathname.replace(/\/+$/, '');
  return `${baseUrl.origin}${prefix}${path}`;
}

async function createOllamaCompletion(messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const { baseUrl, model, apiKey } = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint(baseUrl, '/api/chat'), {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: '5m',
        options: { temperature: 0.7, num_predict: 4_000 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed (HTTP ${response.status}). Check the local model server, model name, and server logs.`);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Ollama returned an invalid response.');
    const message = (result as { message?: unknown }).message;
    const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : null;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Ollama returned no text.');
    return { content, provider: 'Ollama', model };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Ollama request timed out after two minutes.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createOpenRouterCompletion(companyId: string, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const stored = await getCompanyToolCredentials(companyId, OPENROUTER_TOOL_NUMBER, ['OPENROUTER_API_KEY']);
  if (!stored) throw new ToolCredentialsError('Connect OpenRouter in Integrations and set AI_PROVIDER=openrouter to use it.');

  const model = stored.OPENROUTER_MODEL?.trim() || 'openrouter/auto';
  if (model.length > 160 || !/^[A-Za-z0-9._:/~-]+$/.test(model)) {
    throw new ToolCredentialsError('OpenRouter model ID is invalid. Re-save the connection in Integrations.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${stored.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://marketingos.ai',
        'X-OpenRouter-Title': 'MarketingOS',
      },
      body: JSON.stringify({ model, messages, max_tokens: 4_000 }),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter request failed (HTTP ${response.status}). Check the stored key, model ID, and provider balance.`);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('OpenRouter returned an invalid response.');
    const choices = (result as { choices?: unknown }).choices;
    const first = Array.isArray(choices) ? choices[0] : null;
    const message = first && typeof first === 'object' ? (first as { message?: unknown }).message : null;
    const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : null;
    if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned no text.');
    return { content, provider: 'OpenRouter', model };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('OpenRouter request timed out. Please retry.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createZaiCompletion(messages: ChatMessage[]): Promise<ChatCompletionResult> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({ messages, thinking: { type: 'disabled' } });
  const content = completion.choices[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('The Z.AI provider returned no text.');
  return { content, provider: 'Z.AI', model: null };
}

/**
 * Server-side text generation. Self-hosted Ollama is the default and never
 * falls back to a paid API. OpenRouter and the existing Z.AI adapter are only
 * used when an operator explicitly selects them with AI_PROVIDER.
 */
export async function createChatCompletion(companyId: string, messages: ChatMessage[]): Promise<ChatCompletionResult> {
  switch (configuredProvider()) {
    case 'ollama':
      return createOllamaCompletion(messages);
    case 'openrouter':
      return createOpenRouterCompletion(companyId, messages);
    case 'zai':
      return createZaiCompletion(messages);
    default:
      throw new Error('Unsupported AI_PROVIDER. Choose ollama, openrouter, or zai.');
  }
}
