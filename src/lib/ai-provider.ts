import {
  FREE_LLM_PROVIDERS,
  OPENROUTER_FREE_CURATED,
  computeLocalSemanticEmbedding,
  getCachedCompletion,
  recordProviderCall,
  setCachedCompletion,
  type FreeLlmProviderId,
} from './free-ai-stack';

export type AiProviderName = FreeLlmProviderId;

export interface ToolFunctionDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCallRequest[];
}

export interface ChatCompletionOptions {
  model?: string;
  provider?: AiProviderName;
  fallbackChain?: AiProviderName[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  tools?: ToolFunctionDefinition[];
  useCache?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  provider: AiProviderName;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  toolCalls?: ToolCallRequest[];
  cached?: boolean;
  attempts?: Array<{ provider: AiProviderName; model: string; status: 'ok' | 'error'; latencyMs: number; error?: string }>;
}

export interface AiProviderConfig {
  provider: AiProviderName;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  timeoutMs: number;
  selfHostedOnly: boolean;
  automaticPaidFallback: false;
  fallbackChain: AiProviderName[];
}

export class AiProviderError extends Error {
  readonly code: 'AI_DISABLED' | 'AI_MISCONFIGURED' | 'AI_UNAVAILABLE' | 'AI_UPSTREAM_ERROR';
  readonly status: number;

  constructor(
    code: AiProviderError['code'],
    message: string,
    status = 503,
  ) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';
const DEFAULT_TIMEOUT_MS = 45_000;

const VALID_PROVIDER_SET = new Set<string>(FREE_LLM_PROVIDERS.map((p) => p.id));

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function parseTimeoutMs(override?: number) {
  const raw = override ?? Number(process.env.AI_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 1_000) return DEFAULT_TIMEOUT_MS;
  return Math.min(raw, 180_000);
}

export function normalizeProviderBaseUrl(rawUrl: string, envName = 'PROVIDER_BASE_URL'): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AiProviderError('AI_MISCONFIGURED', `${envName} must be a valid http or https URL.`, 500);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AiProviderError('AI_MISCONFIGURED', `${envName} must use http or https.`, 500);
  }
  if (parsed.username || parsed.password) {
    throw new AiProviderError('AI_MISCONFIGURED', `${envName} must not embed credentials in the URL.`, 500);
  }
  return trimTrailingSlash(trimmed);
}

function validateHttpBaseUrl(rawUrl: string, envName: string) {
  return normalizeProviderBaseUrl(rawUrl, envName);
}

function parseProviderName(rawInput?: string): AiProviderName {
  const raw = (rawInput ?? process.env.AI_PROVIDER ?? 'ollama').trim().toLowerCase();
  if (raw === 'disabled' || raw === 'none' || raw === 'off') {
    throw new AiProviderError(
      'AI_DISABLED',
      'AI features are disabled. Set AI_PROVIDER to ollama, groq, gemini, cerebras, openrouter, or another free provider to enable inference.',
      503,
    );
  }
  if (VALID_PROVIDER_SET.has(raw)) {
    return raw as AiProviderName;
  }
  throw new AiProviderError(
    'AI_MISCONFIGURED',
    `Unsupported AI_PROVIDER "${raw}". Supported providers: ${Array.from(VALID_PROVIDER_SET).join(', ')}, or disabled.`,
    500,
  );
}

function parseFallbackChainFromEnv(): AiProviderName[] {
  const raw = (process.env.AI_FALLBACK_CHAIN || '').trim();
  if (!raw) return [];
  const items: AiProviderName[] = [];
  for (const part of raw.split(',')) {
    const clean = part.trim().toLowerCase();
    if (VALID_PROVIDER_SET.has(clean)) {
      items.push(clean as AiProviderName);
    }
  }
  return items;
}

function resolveProviderEndpoint(provider: AiProviderName, modelOverride?: string): {
  provider: AiProviderName;
  baseUrl: string;
  model: string;
  apiKey: string;
  apiKeyConfigured: boolean;
  selfHostedOnly: boolean;
} {
  if (provider === 'ollama') {
    const baseUrl = validateHttpBaseUrl(
      process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
      'OLLAMA_BASE_URL',
    );
    const model = (modelOverride || process.env.OLLAMA_CHAT_MODEL || DEFAULT_OLLAMA_MODEL).trim();
    if (!model) {
      throw new AiProviderError('AI_MISCONFIGURED', 'OLLAMA_CHAT_MODEL cannot be empty.', 500);
    }
    const apiKey = (process.env.OLLAMA_API_KEY || '').trim();
    return {
      provider,
      baseUrl,
      model,
      apiKey,
      apiKeyConfigured: Boolean(apiKey),
      selfHostedOnly: true,
    };
  }

  if (provider === 'openai-compatible') {
    const rawBaseUrl = (process.env.AI_COMPATIBLE_BASE_URL || '').trim();
    const model = (modelOverride || process.env.AI_COMPATIBLE_MODEL || '').trim();
    if (!rawBaseUrl || !model) {
      throw new AiProviderError(
        'AI_MISCONFIGURED',
        'AI_COMPATIBLE_BASE_URL and AI_COMPATIBLE_MODEL are required when AI_PROVIDER=openai-compatible.',
        500,
      );
    }
    const baseUrl = validateHttpBaseUrl(rawBaseUrl, 'AI_COMPATIBLE_BASE_URL');
    const apiKey = (process.env.AI_COMPATIBLE_API_KEY || '').trim();
    return {
      provider,
      baseUrl,
      model,
      apiKey,
      apiKeyConfigured: Boolean(apiKey),
      selfHostedOnly: true,
    };
  }

  const spec = FREE_LLM_PROVIDERS.find((p) => p.id === provider);
  if (!spec) {
    throw new AiProviderError('AI_MISCONFIGURED', `Unsupported AI_PROVIDER "${provider}".`, 500);
  }

  let baseUrl = spec.baseUrl;
  if (provider === 'cloudflare') {
    const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    if (!accountId) {
      throw new AiProviderError(
        'AI_MISCONFIGURED',
        'CLOUDFLARE_ACCOUNT_ID is required when AI_PROVIDER=cloudflare.',
        500,
      );
    }
    baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`;
  }

  const envModelKey = `${provider.toUpperCase().replace(/-/g, '_')}_MODEL`;
  const model = (modelOverride || process.env[envModelKey] || spec.defaultModel).trim();
  const apiKey = (
    process.env[spec.envKey] ||
    (provider === 'gemini' ? process.env.GOOGLE_AI_STUDIO_KEY || '' : '')
  ).trim();

  if (spec.requiresKey && !apiKey) {
    throw new AiProviderError(
      'AI_MISCONFIGURED',
      `${spec.envKey} is not configured for free provider "${spec.name}". Add it in Settings / .env (${spec.signupUrl}).`,
      503,
    );
  }

  return {
    provider,
    baseUrl: trimTrailingSlash(baseUrl),
    model,
    apiKey: apiKey || 'free-keyless',
    apiKeyConfigured: Boolean(apiKey) || !spec.requiresKey,
    selfHostedOnly: false,
  };
}

export function getAiProviderConfig(options: ChatCompletionOptions = {}): AiProviderConfig {
  const provider = parseProviderName(options.provider);
  const timeoutMs = parseTimeoutMs(options.timeoutMs);
  const resolved = resolveProviderEndpoint(provider, options.model);
  const fallbackChain = options.fallbackChain ?? parseFallbackChainFromEnv();

  return {
    provider: resolved.provider,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    apiKeyConfigured: resolved.apiKeyConfigured,
    timeoutMs,
    selfHostedOnly: resolved.selfHostedOnly,
    automaticPaidFallback: false,
    fallbackChain,
  };
}

export async function getAiProviderStatus() {
  try {
    const config = getAiProviderConfig();
    const headers: Record<string, string> = {};
    if (config.provider === 'ollama' && process.env.OLLAMA_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
    } else if (config.provider === 'openai-compatible' && process.env.AI_COMPATIBLE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.AI_COMPATIBLE_API_KEY}`;
    } else {
      const spec = FREE_LLM_PROVIDERS.find((p) => p.id === config.provider);
      const key = spec ? process.env[spec.envKey]?.trim() : '';
      if (key) headers.Authorization = `Bearer ${key}`;
    }

    const probeUrl =
      config.provider === 'ollama'
        ? `${config.baseUrl}/api/tags`
        : config.baseUrl.endsWith('/v1') || config.baseUrl.endsWith('/openai') || config.baseUrl.endsWith('/v4')
          ? `${config.baseUrl}/models`
          : `${config.baseUrl}/v1/models`;

    const response = await fetch(probeUrl, {
      headers,
      signal: AbortSignal.timeout(3_500),
    });

    if (!response.ok) {
      return {
        ...config,
        enabled: true,
        reachable: false,
        status: 'degraded' as const,
        detail: `Provider responded with HTTP ${response.status}.`,
      };
    }

    return {
      ...config,
      enabled: true,
      reachable: true,
      status: 'ready' as const,
      detail: `${config.provider} endpoint is reachable (${config.model}).`,
    };
  } catch (error) {
    if (error instanceof AiProviderError && error.code === 'AI_DISABLED') {
      return {
        provider: 'disabled' as const,
        baseUrl: null,
        model: null,
        apiKeyConfigured: false,
        timeoutMs: parseTimeoutMs(),
        selfHostedOnly: true,
        automaticPaidFallback: false as const,
        fallbackChain: [],
        enabled: false,
        reachable: false,
        status: 'disabled' as const,
        detail: error.message,
      };
    }

    return {
      provider: (process.env.AI_PROVIDER || 'ollama').trim().toLowerCase(),
      baseUrl: process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
      model: process.env.OLLAMA_CHAT_MODEL || DEFAULT_OLLAMA_MODEL,
      apiKeyConfigured: false,
      timeoutMs: parseTimeoutMs(),
      selfHostedOnly: true,
      automaticPaidFallback: false as const,
      fallbackChain: parseFallbackChainFromEnv(),
      enabled: true,
      reachable: false,
      status: 'unreachable' as const,
      detail:
        error instanceof AiProviderError
          ? error.message
          : 'Configured AI endpoint is not reachable. Start Ollama locally or configure a free provider key in Free AI Hub.',
    };
  }
}

async function invokeSingleProvider(
  provider: AiProviderName,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const timeoutMs = parseTimeoutMs(options.timeoutMs);
  const resolved = resolveProviderEndpoint(provider, options.model);
  const startedAt = Date.now();

  // Native Ollama /api/chat path when no OpenAI tool definitions are supplied
  if (provider === 'ollama' && (!options.tools || options.tools.length === 0)) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (resolved.apiKey) headers.Authorization = `Bearer ${resolved.apiKey}`;

    let response: Response;
    try {
      response = await fetch(`${resolved.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: resolved.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          options: {
            ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
            ...(options.maxTokens === undefined ? {} : { num_predict: options.maxTokens }),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      const latencyMs = Date.now() - startedAt;
      recordProviderCall({ provider, latencyMs, error: 'unreachable' });
      throw new AiProviderError(
        'AI_UNAVAILABLE',
        `Self-hosted AI provider "${resolved.provider}" is unreachable at ${resolved.baseUrl}. Start the local model runtime or set AI_PROVIDER=disabled.`,
        503,
      );
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 240);
      recordProviderCall({ provider, latencyMs: Date.now() - startedAt, error: `HTTP ${response.status}` });
      throw new AiProviderError(
        'AI_UPSTREAM_ERROR',
        `Self-hosted AI provider returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        502,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      message?: { content?: string };
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const content = (data.message?.content ?? data.response ?? '').trim();
    if (!content) {
      throw new AiProviderError('AI_UPSTREAM_ERROR', 'Self-hosted AI provider returned an empty completion.', 502);
    }

    const totalTokens = (data.prompt_eval_count || 0) + (data.eval_count || 0);
    recordProviderCall({ provider, latencyMs: Date.now() - startedAt, tokens: totalTokens });

    return {
      content,
      provider: resolved.provider,
      model: data.model || resolved.model,
      promptTokens: data.prompt_eval_count,
      completionTokens: data.eval_count,
    };
  }

  // OpenAI-compatible /chat/completions path (used by all 16 free cloud providers, openai-compatible, and Ollama w/ tools)
  const openAiBase =
    provider === 'ollama'
      ? `${resolved.baseUrl}/v1`
      : resolved.baseUrl.endsWith('/v1') ||
          resolved.baseUrl.endsWith('/openai') ||
          resolved.baseUrl.endsWith('/v4')
        ? resolved.baseUrl
        : `${resolved.baseUrl}/v1`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (resolved.apiKey && resolved.apiKey !== 'free-keyless') {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    headers['X-Title'] = 'MarketingOS Free AI Hub';
  }

  // Retry once on 429 rate-limit with short backoff
  let lastStatus = 0;
  let lastDetail = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${openAiBase}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: resolved.model,
          messages,
          stream: false,
          ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
          ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
          ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      recordProviderCall({ provider, latencyMs: Date.now() - startedAt, error: 'unreachable' });
      const prefix = resolved.selfHostedOnly ? 'Self-hosted AI provider' : 'Free AI provider';
      throw new AiProviderError(
        'AI_UNAVAILABLE',
        `${prefix} "${resolved.provider}" is unreachable at ${resolved.baseUrl}.`,
        503,
      );
    }

    if (response.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 850));
      continue;
    }

    if (!response.ok) {
      lastStatus = response.status;
      lastDetail = (await response.text().catch(() => '')).slice(0, 240);
      recordProviderCall({ provider, latencyMs: Date.now() - startedAt, error: `HTTP ${lastStatus}` });
      throw new AiProviderError(
        'AI_UPSTREAM_ERROR',
        `AI provider "${resolved.provider}" returned HTTP ${lastStatus}${lastDetail ? `: ${lastDetail}` : ''}`,
        502,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string }> | null;
          tool_calls?: ToolCallRequest[];
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = data.choices?.[0]?.message;
    const rawContent = msg?.content;
    const content = Array.isArray(rawContent)
      ? rawContent.map((part) => part.text || '').join('').trim()
      : (rawContent || '').trim();
    const toolCalls = msg?.tool_calls;

    if (!content && (!toolCalls || toolCalls.length === 0)) {
      throw new AiProviderError('AI_UPSTREAM_ERROR', `AI provider "${resolved.provider}" returned an empty completion.`, 502);
    }

    const totalTokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
    recordProviderCall({ provider, latencyMs: Date.now() - startedAt, tokens: totalTokens });

    return {
      content,
      provider: resolved.provider,
      model: data.model || resolved.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }

  throw new AiProviderError(
    'AI_UPSTREAM_ERROR',
    `AI provider "${resolved.provider}" returned HTTP ${lastStatus}${lastDetail ? `: ${lastDetail}` : ''}`,
    502,
  );
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  if (!messages.length) {
    throw new AiProviderError('AI_MISCONFIGURED', 'At least one chat message is required.', 400);
  }

  const primaryProvider = parseProviderName(options.provider);
  const explicitChain = options.fallbackChain ?? parseFallbackChainFromEnv();
  const providersToTry: AiProviderName[] = [
    primaryProvider,
    ...explicitChain.filter((p) => p !== primaryProvider),
  ];

  // Prompt cache check (only for deterministic non-tool queries when explicitly enabled)
  const canCache =
    options.useCache === true &&
    (!options.tools || options.tools.length === 0) &&
    (options.temperature ?? 0.2) <= 0.3;
  const cacheKey = canCache
    ? JSON.stringify({ p: primaryProvider, m: options.model || '', msgs: messages })
    : '';

  if (canCache) {
    const hit = getCachedCompletion(cacheKey);
    if (hit) {
      recordProviderCall({ provider: hit.provider, latencyMs: 1, cached: true });
      return {
        content: hit.content,
        provider: hit.provider as AiProviderName,
        model: hit.model,
        cached: true,
      };
    }
  }

  const attempts: NonNullable<ChatCompletionResult['attempts']> = [];
  let lastError: unknown = null;

  for (let idx = 0; idx < providersToTry.length; idx++) {
    const candidate = providersToTry[idx];
    const started = Date.now();
    try {
      // Only pass explicit model override to the primary provider so fallback providers use their own free default model
      const candidateOptions = idx === 0 ? options : { ...options, model: undefined };
      const res = await invokeSingleProvider(candidate, messages, candidateOptions);
      attempts.push({
        provider: candidate,
        model: res.model,
        status: 'ok',
        latencyMs: Date.now() - started,
      });
      if (canCache && res.content) {
        setCachedCompletion(cacheKey, { content: res.content, model: res.model, provider: res.provider });
      }
      return attempts.length > 1 ? { ...res, attempts } : res;
    } catch (err) {
      lastError = err;
      attempts.push({
        provider: candidate,
        model: options.model || 'default',
        status: 'error',
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AiProviderError('AI_UNAVAILABLE', 'All configured AI providers failed.', 503);
}

// ─── Free Embeddings Adapter (Ollama / Gemini / Cloudflare / HF / Local 128d) ─

export async function generateEmbeddingVector(text: string): Promise<{
  vector: number[];
  provider: string;
  model: string;
}> {
  const embedProvider = (process.env.AI_EMBED_PROVIDER || 'local').trim().toLowerCase();

  if (embedProvider === 'ollama') {
    try {
      const base = trimTrailingSlash(process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL);
      const model = (process.env.OLLAMA_EMBED_MODEL || 'bge-m3').trim();
      const resp = await fetch(`${base}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { embeddings?: number[][] };
        if (data.embeddings?.[0]?.length) {
          return { vector: data.embeddings[0], provider: 'ollama', model };
        }
      }
    } catch {
      // Fall back to deterministic local semantic vector so Wiki/RAG always works
    }
  }

  if (embedProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      const model = 'gemini-embedding-001';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as { embedding?: { values?: number[] } };
        if (data.embedding?.values?.length) {
          return { vector: data.embedding.values, provider: 'gemini', model };
        }
      }
    } catch {
      // Fall back to deterministic local semantic vector
    }
  }

  return {
    vector: computeLocalSemanticEmbedding(text, 128),
    provider: 'local-semantic',
    model: 'marketingos-bm25-trigram-128d',
  };
}

// ─── Live OpenRouter :free Discovery ─────────────────────────────────────────

export async function fetchOpenRouterFreeModels(): Promise<{
  source: 'live' | 'curated';
  count: number;
  models: Array<{ id: string; name: string; contextLength?: number; strength?: string; toolCalling?: boolean }>;
}> {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      const payload = (await resp.json()) as {
        data?: Array<{ id: string; name?: string; context_length?: number; supported_parameters?: string[] }>;
      };
      const freeModels = (payload.data || [])
        .filter((d) => typeof d.id === 'string' && d.id.endsWith(':free'))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => {
          const curated = OPENROUTER_FREE_CURATED.find((c) => c.id === d.id);
          return {
            id: d.id,
            name: d.name || d.id,
            contextLength: d.context_length,
            strength: curated?.strength || 'Free OpenRouter endpoint ($0/M tokens)',
            toolCalling:
              curated?.toolCalling ??
              Boolean(d.supported_parameters?.includes('tools')),
          };
        });
      if (freeModels.length > 0) {
        return { source: 'live', count: freeModels.length, models: freeModels };
      }
    }
  } catch {
    // Offline or sandbox network restriction — return curated list cleanly
  }

  return {
    source: 'curated',
    count: OPENROUTER_FREE_CURATED.length,
    models: OPENROUTER_FREE_CURATED.map((c) => ({
      id: c.id,
      name: c.id,
      strength: c.strength,
      toolCalling: c.toolCalling,
    })),
  };
}

// ─── Self-Hosted Local Media Adapters (Preserved from HEAD, fixed regexes) ────

const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  '1024x1024': { width: 1024, height: 1024 },
  '768x1344': { width: 768, height: 1344 },
  '1344x768': { width: 1344, height: 768 },
  '1440x720': { width: 1440, height: 720 },
  '720x1440': { width: 720, height: 1440 },
  '864x1152': { width: 864, height: 1152 },
  '1152x864': { width: 1152, height: 864 },
};

export async function generateLocalImage(
  prompt: string,
  size = '1024x1024',
  steps = 25,
): Promise<{ dataUrl: string }> {
  const dimensions = IMAGE_SIZES[size];
  if (!dimensions) throw new Error('Unsupported image size');
  const baseUrl = normalizeProviderBaseUrl(
    process.env.IMAGE_GENERATION_URL || 'http://127.0.0.1:7860',
    'IMAGE_GENERATION_URL',
  );
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        width: dimensions.width,
        height: dimensions.height,
        steps: Math.min(40, Math.max(1, Number(steps) || 25)),
        batch_size: 1,
        n_iter: 1,
      }),
      signal: AbortSignal.timeout(Number(process.env.IMAGE_GENERATION_TIMEOUT_MS) || 120_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Local image service is unavailable. Configure IMAGE_GENERATION_URL. No cloud fallback was attempted.');
  }
  if (!response.ok) throw new Error(`Local image service returned HTTP ${response.status}`);
  const result = (await response.json()) as { images?: string[] };
  const image = result.images?.[0];
  if (!image) throw new Error('Local image service returned no image');
  return { dataUrl: image.startsWith('data:') ? image : `data:image/png;base64,${image}` };
}

export async function generateLocalVideo(
  prompt: string,
  options: { duration?: number; referenceImageUrl?: string } = {},
): Promise<{ videoUrl: string; taskId: string; status: string }> {
  const rawUrl = process.env.VIDEO_GENERATION_URL?.trim();
  if (!rawUrl) throw new Error('VIDEO_GENERATION_URL is not configured');
  const baseUrl = normalizeProviderBaseUrl(rawUrl, 'VIDEO_GENERATION_URL');
  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...options }),
    signal: AbortSignal.timeout(Number(process.env.VIDEO_GENERATION_TIMEOUT_MS) || 120_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const data = (await response.json()) as Record<string, unknown>;
  const taskId = data.taskId || data.id;
  if (typeof taskId !== 'string' || !taskId) throw new Error('Local video service returned no task ID');
  return {
    taskId,
    videoUrl: String(data.videoUrl || data.video_url || data.url || ''),
    status: String(data.status || (data.completed ? 'completed' : 'processing')),
  };
}

export async function getLocalVideoStatus(taskId: string): Promise<{ status: string; videoUrl: string }> {
  const rawUrl = process.env.VIDEO_GENERATION_URL?.trim();
  if (!rawUrl) throw new Error('VIDEO_GENERATION_URL is not configured');
  const baseUrl = normalizeProviderBaseUrl(rawUrl, 'VIDEO_GENERATION_URL');
  const response = await fetch(`${baseUrl}/status/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    signal: AbortSignal.timeout(Number(process.env.VIDEO_GENERATION_TIMEOUT_MS) || 30_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const data = (await response.json()) as Record<string, unknown>;
  return {
    status: String(data.status || 'processing'),
    videoUrl: String(data.videoUrl || data.video_url || data.url || ''),
  };
}

export async function generateLocalSpeech(text: string, voice = 'default'): Promise<{ audioUrl: string }> {
  const rawUrl = process.env.TTS_SERVICE_URL?.trim();
  if (!rawUrl) throw new Error('TTS_SERVICE_URL is not configured');
  const baseUrl = normalizeProviderBaseUrl(rawUrl, 'TTS_SERVICE_URL');
  const response = await fetch(`${baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(Number(process.env.TTS_TIMEOUT_MS) || 60_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local TTS service returned HTTP ${response.status}`);
  const data = (await response.json()) as Record<string, unknown>;
  const audioUrl =
    data.audioUrl || data.audio_url || (data.audioBase64 ? `data:audio/wav;base64,${String(data.audioBase64)}` : '');
  if (typeof audioUrl !== 'string' || !audioUrl) {
    throw new Error('Local TTS service returned no audio URL or audio data');
  }
  return { audioUrl };
}
