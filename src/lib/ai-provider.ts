/**
 * Self-hosted AI gateway for MarketingOS.
 *
 * Default provider is Ollama on the operator's own infrastructure. There is
 * intentionally no automatic cloud-provider fallback. If the local model
 * server is unavailable, callers receive an error and can show a truthful
 * degraded state rather than silently incur third-party charges.
 *
 * Compatible servers may be selected explicitly with AI_PROVIDER=openai-compatible
 * (for example a self-hosted vLLM endpoint). This does not imply OpenAI hosting.
 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;

function getTimeoutMs(): number {
  const value = Number(process.env.AI_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1_000 && value <= 600_000
    ? value
    : DEFAULT_TIMEOUT_MS;
}

function providerName(): string {
  return (process.env.AI_PROVIDER || 'ollama').trim().toLowerCase();
}

function baseUrl(): string {
  const provider = providerName();
  if (provider === 'ollama') {
    return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  }
  if (provider === 'openai-compatible') {
    const value = process.env.AI_COMPATIBLE_BASE_URL;
    if (!value) throw new Error('AI_COMPATIBLE_BASE_URL is required for AI_PROVIDER=openai-compatible');
    return value.replace(/\/+$/, '');
  }
  throw new Error(`Unsupported AI_PROVIDER "${provider}". Supported providers: ollama, openai-compatible.`);
}

function modelName(): string {
  if (providerName() === 'ollama') {
    const model = process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:7b';
    if (!model.trim()) throw new Error('OLLAMA_CHAT_MODEL must not be empty');
    return model.trim();
  }
  const model = process.env.AI_COMPATIBLE_MODEL;
  if (!model?.trim()) throw new Error('AI_COMPATIBLE_MODEL is required for AI_PROVIDER=openai-compatible');
  return model.trim();
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<ChatCompletionResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('At least one chat message is required');
  }
  const provider = providerName();
  const model = modelName();
  const url = provider === 'ollama' ? `${baseUrl()}/api/chat` : `${baseUrl()}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'openai-compatible' && process.env.AI_COMPATIBLE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AI_COMPATIBLE_API_KEY}`;
  }
  const body = provider === 'ollama'
    ? {
        model,
        messages,
        stream: false,
        options: {
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.maxTokens !== undefined ? { num_predict: options.maxTokens } : {}),
        },
      }
    : {
        model,
        messages,
        stream: false,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(getTimeoutMs()),
      cache: 'no-store',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network error';
    throw new Error(`Self-hosted AI provider "${provider}" is unreachable at ${url}: ${reason}`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`AI provider "${provider}" returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json() as any;
  const result = provider === 'ollama'
    ? {
        content: data.message?.content,
        model: data.model || model,
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
      }
    : {
        content: data.choices?.[0]?.message?.content,
        model: data.model || model,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      };

  if (typeof result.content !== 'string' || !result.content.trim()) {
    throw new Error(`AI provider "${provider}" returned an empty or invalid response`);
  }
  return {
    content: result.content,
    model: result.model,
    ...(typeof result.promptTokens === 'number' ? { promptTokens: result.promptTokens } : {}),
    ...(typeof result.completionTokens === 'number' ? { completionTokens: result.completionTokens } : {}),
  };
}

/** Safe operational status for the Settings / integrations UI. */
export function getAiProviderConfig() {
  const provider = providerName();
  return {
    provider,
    model: provider === 'ollama'
      ? (process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:7b')
      : (process.env.AI_COMPATIBLE_MODEL || ''),
    baseUrl: provider === 'ollama'
      ? (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434')
      : (process.env.AI_COMPATIBLE_BASE_URL || ''),
    automaticPaidFallback: false as const,
  };
}
