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
  const provider = (process.env.AI_PROVIDER || 'ollama').trim().toLowerCase();
  if (provider !== 'ollama' && provider !== 'openai-compatible') {
    throw new Error(`Unsupported AI_PROVIDER "${provider}". Supported providers: ollama, openai-compatible.`);
  }
  return provider;
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


const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  '1024x1024': { width: 1024, height: 1024 },
  '768x1344': { width: 768, height: 1344 },
  '1344x768': { width: 1344, height: 768 },
  '1440x720': { width: 1440, height: 720 },
  '720x1440': { width: 720, height: 1440 },
  '864x1152': { width: 864, height: 1152 },
  '1152x864': { width: 1152, height: 864 },
};

export async function generateLocalImage(prompt: string, size = '1024x1024'): Promise<{ dataUrl: string }> {
  const dimensions = IMAGE_SIZES[size];
  if (!dimensions) throw new Error('Unsupported image size');
  const baseUrl = (process.env.IMAGE_GENERATION_URL || 'http://127.0.0.1:7860').replace(/\\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width: dimensions.width, height: dimensions.height, steps: 25, batch_size: 1, n_iter: 1 }),
      signal: AbortSignal.timeout(Number(process.env.IMAGE_GENERATION_TIMEOUT_MS) || 120_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Local image service is unavailable. Configure IMAGE_GENERATION_URL. No cloud fallback was attempted.');
  }
  if (!response.ok) throw new Error(`Local image service returned HTTP ${response.status}`);
  const result = await response.json() as { images?: string[] };
  const image = result.images?.[0];
  if (!image) throw new Error('Local image service returned no image');
  return { dataUrl: image.startsWith('data:') ? image : `data:image/png;base64,${image}` };
}

/**
 * Video and speech services are self-hosted adapter contracts. Configure a
 * local adapter that implements POST /generate and GET /status/:taskId for
 * video, and POST /api/tts for speech. Missing services fail closed.
 */
export async function generateLocalVideo(prompt: string, options: { duration?: number; referenceImageUrl?: string } = {}): Promise<{ videoUrl: string; taskId: string; status: string }> {
  const baseUrl = process.env.VIDEO_GENERATION_URL?.replace(/\\/+$/, '');
  if (!baseUrl) throw new Error('VIDEO_GENERATION_URL is not configured');
  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...options }),
    signal: AbortSignal.timeout(Number(process.env.VIDEO_GENERATION_TIMEOUT_MS) || 120_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const data = await response.json() as any;
  const taskId = data.taskId || data.id;
  if (typeof taskId !== 'string' || !taskId) throw new Error('Local video service returned no task ID');
  return {
    taskId,
    videoUrl: String(data.videoUrl || data.video_url || data.url || ''),
    status: String(data.status || (data.completed ? 'completed' : 'processing')),
  };
}

export async function getLocalVideoStatus(taskId: string): Promise<{ status: string; videoUrl: string }> {
  const baseUrl = process.env.VIDEO_GENERATION_URL?.replace(/\\/+$/, '');
  if (!baseUrl) throw new Error('VIDEO_GENERATION_URL is not configured');
  const response = await fetch(`${baseUrl}/status/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    signal: AbortSignal.timeout(Number(process.env.VIDEO_GENERATION_TIMEOUT_MS) || 30_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const data = await response.json() as any;
  return {
    status: String(data.status || 'processing'),
    videoUrl: String(data.videoUrl || data.video_url || data.url || ''),
  };
}

export async function generateLocalSpeech(text: string, voice = 'default'): Promise<{ audioUrl: string }> {
  const baseUrl = process.env.TTS_SERVICE_URL?.replace(/\\/+$/, '');
  if (!baseUrl) throw new Error('TTS_SERVICE_URL is not configured');
  const response = await fetch(`${baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(Number(process.env.TTS_TIMEOUT_MS) || 60_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Local TTS service returned HTTP ${response.status}`);
  const data = await response.json() as any;
  const audioUrl = data.audioUrl || data.audio_url || (data.audioBase64 ? `data:audio/wav;base64,${data.audioBase64}` : '');
  if (typeof audioUrl !== 'string' || !audioUrl) throw new Error('Local TTS service returned no audio URL or audio data');
  return { audioUrl };
}
