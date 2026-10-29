/**
 * Complete 100% Free AI & Agent Services Registry + Code Generators + ModelDeck Telemetry.
 *
 * Covers:
 *  1. 16 configured LLM adapters (Groq, Google AI Studio, Cerebras, OpenRouter :free,
 *     Cloudflare Workers AI, SambaNova, Chutes, Pollinations, Zhipu GLM, ModelScope,
 *     SiliconFlow, Mistral, NVIDIA NIM, Hugging Face, Ollama Local, OpenAI-Compatible)
 *  2. 7 Free Embedding Providers + deterministic 128-dim local semantic vector engine
 *  3. Free Image Generation services
 *  4. Free Speech-to-Text (STT) services
 *  5. Free Text-to-Speech (TTS) services
 *  6. Free Search, Data & Tool APIs
 *  7. Free Storage, Vector DB & Hosting infrastructure
 *  8. 18 Free Agent Frameworks
 *  9. 25 Free MCP (Model Context Protocol) Servers
 * 10. Local Ollama Model & Hardware Sizing Matrix + Quick-Start Code Generators
 */

export type FreeLlmProviderId =
  | 'ollama'
  | 'groq'
  | 'gemini'
  | 'cerebras'
  | 'openrouter'
  | 'cloudflare'
  | 'sambanova'
  | 'chutes'
  | 'pollinations'
  | 'zhipu'
  | 'modelscope'
  | 'siliconflow'
  | 'mistral'
  | 'nvidia-nim'
  | 'huggingface'
  | 'openai-compatible';

export interface FreeLlmProviderSpec {
  id: FreeLlmProviderId;
  name: string;
  badge?: string;
  tier: 'no-card' | 'aggregator' | 'local';
  baseUrl: string;
  envKey: string;
  defaultModel: string;
  freeModels: string[];
  limits: string;
  signupUrl: string;
  rpmEstimate: number;
  rpdEstimate: number;
  supportsToolCalling: boolean;
  requiresKey: boolean;
}

export const FREE_LLM_PROVIDERS: FreeLlmProviderSpec[] = [
  {
    id: 'ollama',
    name: 'Ollama (Self-Hosted Local)',
    badge: 'Default · $0 Private',
    tier: 'local',
    baseUrl: 'http://127.0.0.1:11434',
    envKey: 'OLLAMA_BASE_URL',
    defaultModel: 'qwen2.5:7b',
    freeModels: [
      'qwen3:30b-a3b',
      'qwen3:32b',
      'qwen3:8b',
      'qwen2.5:7b',
      'llama3.3:70b',
      'llama3.2:3b',
      'gemma3:12b',
      'mistral-small3.2:24b',
      'phi4:14b',
      'deepseek-r1:14b',
      'deepseek-r1:32b',
      'gpt-oss:20b',
      'qwen3-coder:30b',
      'llama3.2-vision:11b',
    ],
    limits: 'Unlimited local inference ($0 API cost)',
    signupUrl: 'https://ollama.com',
    rpmEstimate: 9999,
    rpdEstimate: 999999,
    supportsToolCalling: true,
    requiresKey: false,
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Free tier · quota-limited',
    tier: 'no-card',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'openai/gpt-oss-20b',
    freeModels: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
    ],
    limits: 'Model-specific free limits; check the live Groq organization limits before production use',
    signupUrl: 'https://console.groq.com',
    rpmEstimate: 30,
    rpdEstimate: 1000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'gemini',
    name: 'Google AI Studio (Gemini)',
    badge: '⭐ 1M Context',
    tier: 'no-card',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    freeModels: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
    ],
    limits: '~15–30 RPM (500–1,500 RPD), 1M context window, no card required',
    signupUrl: 'https://aistudio.google.com',
    rpmEstimate: 15,
    rpdEstimate: 500,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras Inference',
    badge: '⭐ Ultra-Fast Wafer',
    tier: 'no-card',
    baseUrl: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    defaultModel: 'qwen-3-32b',
    freeModels: [
      'llama-3.3-70b',
      'llama3.1-8b',
      'qwen-3-235b-a22b-instruct-2507',
      'qwen-3-32b',
      'qwen-3-30b-a3b',
      'openai/gpt-oss-120b',
    ],
    limits: 'Very generous tiered RPM/TPD, no card required',
    signupUrl: 'https://cloud.cerebras.ai',
    rpmEstimate: 30,
    rpdEstimate: 14400,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (:free Aggregator)',
    badge: '⭐ Best Aggregator',
    tier: 'aggregator',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'openrouter/free',
    freeModels: [
      'qwen/qwen3-32b:free',
      'qwen/qwen3-235b-a22b:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'deepseek/deepseek-r1:free',
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'mistralai/mistral-small-3.2-24b-instruct:free',
      'microsoft/phi-3.5-mini-instruct:free',
      'google/gemma-2-9b-it:free',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'moonshotai/kimi-k2-instruct:free',
      'meta-llama/llama-4-scout-17b-16e-instruct:free',
      'nvidia/llama-3.1-nemotron-70b-instruct:free',
    ],
    limits: 'Free-model requests are rate-limited; verify the current live OpenRouter limits and model roster',
    signupUrl: 'https://openrouter.ai/keys',
    rpmEstimate: 20,
    rpdEstimate: 200,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    tier: 'no-card',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
    envKey: 'CLOUDFLARE_API_TOKEN',
    defaultModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    freeModels: [
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/openai/gpt-oss-120b',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/meta/llama-3.1-8b-instruct',
    ],
    limits: '10,000 neurons/day free',
    signupUrl: 'https://dash.cloudflare.com',
    rpmEstimate: 50,
    rpdEstimate: 1000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'sambanova',
    name: 'SambaNova Cloud',
    tier: 'no-card',
    baseUrl: 'https://api.sambanova.ai/v1',
    envKey: 'SAMBANOVA_API_KEY',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    freeModels: [
      'Meta-Llama-3.3-70B-Instruct',
      'DeepSeek-R1-Distill-Llama-70B',
      'Qwen2.5-72B-Instruct',
    ],
    limits: '~20 RPM free tier',
    signupUrl: 'https://cloud.sambanova.ai',
    rpmEstimate: 20,
    rpdEstimate: 1000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'chutes',
    name: 'Chutes.ai',
    tier: 'no-card',
    baseUrl: 'https://llm.chutes.ai/v1',
    envKey: 'CHUTES_API_KEY',
    defaultModel: 'Qwen/Qwen3-32B',
    freeModels: [
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen3-32B',
      'unsloth/DeepSeek-R1',
    ],
    limits: 'Generous decentralized free tier',
    signupUrl: 'https://chutes.ai',
    rpmEstimate: 20,
    rpdEstimate: 1000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'pollinations',
    name: 'Pollinations.ai',
    badge: 'No Key · No Signup',
    tier: 'no-card',
    baseUrl: 'https://text.pollinations.ai/openai',
    envKey: 'POLLINATIONS_API_KEY',
    defaultModel: 'openai',
    freeModels: ['openai', 'qwen-coder', 'llama', 'mistral', 'deepseek-reasoning'],
    limits: 'No key, no signup community rate limits',
    signupUrl: 'https://pollinations.ai',
    rpmEstimate: 15,
    rpdEstimate: 500,
    supportsToolCalling: false,
    requiresKey: false,
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (BigModel / GLM)',
    tier: 'no-card',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    envKey: 'ZHIPU_API_KEY',
    defaultModel: 'glm-4-flash',
    freeModels: ['glm-4-flash', 'glm-4.5-flash', 'glm-4-air', 'glm-5'],
    limits: 'glm-4-flash / glm-4.5-flash free tier',
    signupUrl: 'https://open.bigmodel.cn',
    rpmEstimate: 30,
    rpdEstimate: 5000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'modelscope',
    name: 'ModelScope (Alibaba)',
    tier: 'no-card',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    envKey: 'MODELSCOPE_API_KEY',
    defaultModel: 'Qwen/Qwen3-32B',
    freeModels: ['Qwen/Qwen3-32B', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
    limits: '2,000 free dev calls/day',
    signupUrl: 'https://modelscope.cn',
    rpmEstimate: 20,
    rpdEstimate: 2000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    tier: 'no-card',
    baseUrl: 'https://api.siliconflow.cn/v1',
    envKey: 'SILICONFLOW_API_KEY',
    defaultModel: 'Qwen/Qwen3-8B',
    freeModels: ['Qwen/Qwen3-8B', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', 'THUDM/glm-4-9b-chat'],
    limits: 'Selected 7B–9B models permanently free',
    signupUrl: 'https://siliconflow.cn',
    rpmEstimate: 30,
    rpdEstimate: 5000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'mistral',
    name: 'Mistral La Plateforme',
    tier: 'no-card',
    baseUrl: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-small-latest',
    freeModels: ['mistral-small-latest', 'magistral-small-latest', 'codestral-latest', 'pixtral-12b-2409'],
    limits: 'Experiment free tier (~1 RPS, monthly token cap)',
    signupUrl: 'https://console.mistral.ai',
    rpmEstimate: 30,
    rpdEstimate: 2000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    tier: 'no-card',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    freeModels: [
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'qwen/qwen3-235b-a22b',
      'nvidia/llama-3.1-nemotron-70b-instruct',
    ],
    limits: '1,000–5,000 free developer credits on signup (100+ models)',
    signupUrl: 'https://build.nvidia.com',
    rpmEstimate: 40,
    rpdEstimate: 2000,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Serverless Inference',
    tier: 'no-card',
    baseUrl: 'https://router.huggingface.co/v1',
    envKey: 'HF_API_TOKEN',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
    freeModels: ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-R1'],
    limits: 'Monthly free serverless credits + free small models',
    signupUrl: 'https://huggingface.co/settings/tokens',
    rpmEstimate: 15,
    rpdEstimate: 500,
    supportsToolCalling: true,
    requiresKey: true,
  },
  {
    id: 'openai-compatible',
    name: 'Custom OpenAI-Compatible (vLLM / LM Studio / LiteLLM)',
    tier: 'local',
    baseUrl: 'http://127.0.0.1:8000/v1',
    envKey: 'AI_COMPATIBLE_API_KEY',
    defaultModel: 'local-model',
    freeModels: ['local-model'],
    limits: 'Self-hosted hardware bound',
    signupUrl: 'https://docs.vllm.ai',
    rpmEstimate: 9999,
    rpdEstimate: 999999,
    supportsToolCalling: true,
    requiresKey: false,
  },
];

export const OPENROUTER_FREE_CURATED: Array<{ id: string; strength: string; toolCalling: boolean }> = [
  { id: 'deepseek/deepseek-chat-v3-0324:free', strength: 'Top-tier free general model', toolCalling: true },
  { id: 'deepseek/deepseek-r1:free', strength: 'Deep chain-of-thought reasoning', toolCalling: false },
  { id: 'openai/gpt-oss-120b:free', strength: 'OpenAI open-weight 120B, strong tool calling', toolCalling: true },
  { id: 'openai/gpt-oss-20b:free', strength: 'Compact & low-latency open-weight', toolCalling: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', strength: 'Reliable general + instruction following', toolCalling: true },
  { id: 'qwen/qwen-2.5-72b-instruct:free', strength: 'Multilingual + coding + structured JSON', toolCalling: true },
  { id: 'qwen/qwen3-32b:free', strength: '⭐ Best-in-class free tool-calling agent model', toolCalling: true },
  { id: 'qwen/qwen3-235b-a22b:free', strength: '⭐ Frontier MoE tool-calling (when available)', toolCalling: true },
  { id: 'google/gemini-2.0-flash-exp:free', strength: 'Fast multimodal + 1M token context', toolCalling: true },
  { id: 'mistralai/mistral-small-3.2-24b-instruct:free', strength: 'Fast European multilingual model', toolCalling: true },
  { id: 'microsoft/phi-3.5-mini-instruct:free', strength: 'Lightweight fast tasks', toolCalling: false },
  { id: 'google/gemma-2-9b-it:free', strength: 'Compact concise drafting', toolCalling: false },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', strength: '405B function-calling & agentic specialist', toolCalling: true },
  { id: 'moonshotai/kimi-k2-instruct:free', strength: 'Long-horizon agentic tool calling', toolCalling: true },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct:free', strength: 'Llama 4 MoE long context', toolCalling: true },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', strength: 'High-accuracy reasoning & Arena ranker', toolCalling: true },
];

export const FREE_EMBEDDING_PROVIDERS = [
  { provider: 'Local Semantic Hash (Built-in)', models: ['marketingos-bm25-trigram-128d'], allowance: 'Unlimited, offline, 0ms network latency ✅' },
  { provider: 'Ollama (Local)', models: ['bge-m3', 'nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed'], allowance: 'Unlimited local ✅' },
  { provider: 'Google AI Studio', models: ['gemini-embedding-001', 'text-embedding-004'], allowance: 'Free tier (1,500 RPM) ✅' },
  { provider: 'Hugging Face', models: ['BAAI/bge-m3', 'BAAI/bge-large-en-v1.5', 'BAAI/bge-small-en-v1.5', 'intfloat/e5-base-v2', 'nomic-ai/nomic-embed-text-v1.5'], allowance: 'Free serverless ✅' },
  { provider: 'Cloudflare Workers AI', models: ['@cf/baai/bge-base-en-v1.5', '@cf/baai/bge-large-en-v1.5', '@cf/baai/bge-m3'], allowance: 'Included in 10k neurons/day ✅' },
  { provider: 'Jina AI', models: ['jina-embeddings-v3'], allowance: '1M tokens free on signup ✅' },
  { provider: 'Nomic Atlas', models: ['nomic-embed-text-v1.5', 'nomic-embed-text-v2'], allowance: '1M tokens/mo free ✅' },
  { provider: 'Mistral', models: ['mistral-embed'], allowance: 'Free experiment tier ✅' },
];

export const FREE_SPEECH_AND_IMAGE_SERVICES = {
  image: [
    { service: 'Local Browser Canvas Studio', notes: 'Built into Media Studio — instant PNG cards, zero API ✅' },
    { service: 'ComfyUI / Stable Diffusion Local', notes: 'FLUX.1-schnell (Apache-2.0, 12GB VRAM), SDXL, SD3.5 — unlimited ✅' },
    { service: 'Pollinations.ai', notes: 'Free, keyless URL endpoint: https://image.pollinations.ai/prompt/{prompt} ✅' },
    { service: 'Hugging Face Spaces / Inference', notes: 'FLUX.1-schnell & SDXL serverless/ZeroGPU (rate-limited) ✅' },
    { service: 'Google AI Studio', notes: 'gemini-2.0-flash-preview-image-generation (Nano Banana) limited free ✅' },
    { service: 'Cloudflare Workers AI', notes: '@cf/black-forest-labs/flux-1-schnell within 10k neurons/day ✅' },
  ],
  stt: [
    { service: 'Groq Whisper ⭐', models: 'whisper-large-v3, whisper-large-v3-turbo', allowance: 'Free tier, real-time ultra-fast ✅' },
    { service: 'Cloudflare Whisper', models: '@cf/openai/whisper, @cf/meta/mms-1b-asr', allowance: '10k neurons/day ✅' },
    { service: 'Hugging Face', models: 'openai/whisper-large-v3-turbo, openai/whisper-tiny', allowance: 'Free serverless ✅' },
    { service: 'Local faster-whisper / whisper.cpp', models: 'CTranslate2 / Ollama / OpenAI-compatible /v1/audio/transcriptions', allowance: 'Unlimited ✅' },
    { service: 'Browser Web Speech API', models: 'Native SpeechRecognition', allowance: 'Built into Media Studio Voice Dictation ✅' },
    { service: 'Deepgram / AssemblyAI / Azure', models: 'Nova-3 / Universal-2 / Azure Speech', allowance: '$200 credit / 5 hrs/mo free ✅' },
  ],
  tts: [
    { service: 'Local OpenAI-Compatible TTS', notes: 'Kokoro-82M, Piper, Coqui XTTS-v2, F5-TTS via LOCAL_TTS_BASE_URL — unlimited ✅' },
    { service: 'Edge-TTS', notes: 'pip install edge-tts — unlimited, no key, natural neural voices ✅' },
    { service: 'Groq TTS', notes: 'playai-tts on Groq free tier ✅' },
    { service: 'Hugging Face', notes: 'hexgrad/Kokoro-82M, facebook/mms-tts-eng serverless ✅' },
    { service: 'Cloudflare Workers AI', notes: '@cf/facebook/mms-tts-eng ✅' },
    { service: 'ElevenLabs / Google Cloud / Azure', notes: '10k chars/mo / 4M standard / 500k neural free tiers ✅' },
  ],
};

export const FREE_INFRA_AND_FRAMEWORKS = {
  storageAndInfra: [
    { category: 'Vector DB', options: 'Pinecone Starter (2GB, 1M vectors), Qdrant Cloud Free (1GB), Weaviate Sandbox, Chroma (local), Milvus/Zilliz (500MB)' },
    { category: 'SQL + pgvector', options: 'SQLite + LibSQL (built-in), Supabase (500MB + pgvector), Neon (pgvector), Turso, CockroachDB free' },
    { category: 'NoSQL & KV Cache', options: 'Upstash Redis (10k/day), Cloudflare KV, MongoDB Atlas (512MB), Firebase Spark' },
    { category: 'Object Storage', options: 'Cloudflare R2 (10GB/mo, zero egress), Supabase Storage (1GB)' },
    { category: 'Serverless & Hosting', options: 'Cloudflare Workers (100k/day), Vercel, Netlify, Render, Koyeb, Hugging Face Spaces (2 vCPU, 16GB RAM free)' },
    { category: 'Serverless GPU', options: 'Kaggle (30h GPU/wk), Google Colab, Modal ($30/mo free), Lightning.ai' },
  ],
  frameworks: [
    { name: 'LangGraph', lang: 'Python/TS', why: 'Stateful, cyclic, resilient multi-step agent graphs ⭐' },
    { name: 'smolagents', lang: 'Python', why: 'Hugging Face minimal code-first & tool-calling agents ⭐' },
    { name: 'LlamaIndex', lang: 'Python/TS', why: 'Document ingestion, knowledge graphs & RAG-heavy agents ⭐' },
    { name: 'Pydantic AI', lang: 'Python', why: 'Type-safe structured agent outputs & dependency injection' },
    { name: 'CrewAI', lang: 'Python', why: 'Role-based autonomous multi-agent teams' },
    { name: 'AutoGen / AG2', lang: 'Python', why: 'Conversational multi-agent orchestration' },
    { name: 'MetaGPT', lang: 'Python', why: 'SOP-driven AI software/marketing company roles' },
    { name: 'Google ADK', lang: 'Python', why: 'Gemini-native multimodal agent toolkit' },
    { name: 'Vercel AI SDK', lang: 'TypeScript', why: 'Streaming tool-calling web apps in Next.js' },
    { name: 'Mastra', lang: 'TypeScript', why: 'Modern TS workflows, memory & evals' },
    { name: 'OpenAI Agents SDK', lang: 'Python/TS', why: 'Works with any OpenAI-compatible :free endpoint' },
    { name: 'Claude Agent SDK', lang: 'Python/TS', why: 'Anthropic open agent harness SDK' },
    { name: 'n8n', lang: 'Self-host', why: 'Visual workflow automation + 400+ integrations & AI nodes ⭐' },
    { name: 'Dify', lang: 'Self-host', why: 'Complete LLM app & RAG studio ⭐' },
    { name: 'Flowise / Langflow', lang: 'Self-host', why: 'Drag-and-drop visual agent graph builders' },
    { name: 'Open WebUI / LibreChat / LobeChat / AnythingLLM', lang: 'Self-host', why: 'Full chat UIs with MCP, RAG, voice & Ollama' },
  ],
  mcpServers: [
    { id: 'filesystem', pkg: '@modelcontextprotocol/server-filesystem', desc: 'Sandboxed local file read/write/search' },
    { id: 'git', pkg: 'mcp-server-git', desc: 'Inspect commits, diffs, branches & repo history' },
    { id: 'github', pkg: '@modelcontextprotocol/server-github', desc: 'PRs, issues, actions, code search via GitHub API' },
    { id: 'gitlab', pkg: '@modelcontextprotocol/server-gitlab', desc: 'GitLab repositories, merge requests & pipelines' },
    { id: 'postgres', pkg: '@modelcontextprotocol/server-postgres', desc: 'Read-only schema inspection & SQL queries' },
    { id: 'sqlite', pkg: 'mcp-server-sqlite', desc: 'Local SQLite database analytics & memo tables' },
    { id: 'playwright', pkg: '@playwright/mcp', desc: 'Accessibility-tree browser automation & scraping' },
    { id: 'puppeteer', pkg: '@modelcontextprotocol/server-puppeteer', desc: 'Headless Chrome navigation & screenshots' },
    { id: 'fetch', pkg: 'mcp-server-fetch', desc: 'Convert web pages to clean LLM-ready Markdown' },
    { id: 'brave-search', pkg: '@modelcontextprotocol/server-brave-search', desc: 'Web & local search (2,000 free queries/mo)' },
    { id: 'memory', pkg: '@modelcontextprotocol/server-memory', desc: 'Persistent entity-relation knowledge graph memory' },
    { id: 'sequential-thinking', pkg: '@modelcontextprotocol/server-sequential-thinking', desc: 'Reflective multi-step branching problem solver' },
    { id: 'time', pkg: 'mcp-server-time', desc: 'Timezone-aware clock & IANA conversion' },
    { id: 'weather', pkg: 'mcp-server-open-meteo', desc: 'Keyless Open-Meteo global weather & forecasts' },
    { id: 'slack', pkg: '@modelcontextprotocol/server-slack', desc: 'Channel history, threads & workspace notifications' },
    { id: 'notion', pkg: '@notionhq/notion-mcp-server', desc: 'Search, read & update Notion pages and databases' },
    { id: 'google-drive', pkg: '@modelcontextprotocol/server-gdrive', desc: 'Search & read Google Docs, Sheets & Drive files' },
    { id: 'google-maps', pkg: '@modelcontextprotocol/server-google-maps', desc: 'Geocoding, places, directions & elevation' },
    { id: 'docker', pkg: 'mcp-server-docker', desc: 'Inspect & manage local containers, logs & networks' },
    { id: 'kubernetes', pkg: 'mcp-server-kubernetes', desc: 'Pod, deployment & cluster diagnostics' },
    { id: 'mcp-server-chart', pkg: '@antv/mcp-server-chart', desc: 'Generate 25+ data visualization charts' },
    { id: 'mcp-server-pdf', pkg: 'mcp-server-pdf', desc: 'Extract text, tables & metadata from PDFs' },
    { id: 'markitdown', pkg: 'markitdown-mcp', desc: 'Microsoft MarkItDown: DOCX/PPTX/XLSX/PDF/HTML → Markdown' },
  ],
  hardwareSizing: [
    { tier: '8 GB RAM', models: 'llama3.2:3b, gemma3:4b, qwen3:4b, whisper-tiny, piper-tts', notes: 'Laptop CPU / Apple M1 base' },
    { tier: '16 GB RAM', models: 'qwen2.5:7b, qwen3:8b, llama3.1:8b, bge-m3, nomic-embed-text', notes: 'Sweet spot for everyday local marketing agents' },
    { tier: '12 GB VRAM GPU', models: 'FLUX.1-schnell + qwen3:30b-a3b (Q4 MoE) + faster-whisper', notes: 'Full multimodal local studio' },
    { tier: '32 GB RAM / Mac', models: 'qwen3:32b, qwen3:30b-a3b, gemma3:12b, phi4:14b, deepseek-r1:32b', notes: 'Near-frontier tool calling & coding offline' },
    { tier: '64 GB+ RAM', models: 'llama3.3:70b, qwen3:235b-a22b MoE', notes: 'Workstation-grade autonomous workforce' },
  ],
  quickStartPaths: [
    { goal: 'No-code agent today', recipe: 'Install n8n (Docker) → add Groq (qwen3-32b) + Tavily Search nodes → activate webhook' },
    { goal: 'Python tool-calling agent in 5 min', recipe: 'Export agent.py below → pip install openai → set GROQ_API_KEY or OPENROUTER_API_KEY → run' },
    { goal: 'Full-stack web marketing agent', recipe: 'MarketingOS + Free AI Hub → configure Groq → Cerebras → OpenRouter :free → Ollama fallback chain' },
    { goal: 'Chat UI with local models', recipe: 'Open WebUI (Docker) + Ollama (qwen3:30b-a3b + bge-m3) + Qdrant' },
    { goal: 'Multi-agent marketing team', recipe: 'MarketingOS Workforce / CrewAI + Groq (Strategist, Copywriter, SEO, Analyst) + MCP servers' },
    { goal: 'Voice & meeting agent', recipe: 'Media Studio Voice/Captioner + Groq Whisper STT + Local Kokoro/Edge-TTS + Qwen3 LLM' },
    { goal: 'Document & Wiki RAG agent', recipe: 'MarketingOS Knowledge Wiki + Gemini Flash (1M ctx) / Ollama + bge-m3 embeddings' },
    { goal: '100% private & $0 offline', recipe: 'docker compose -f docker-compose.prod.yml -f docker-compose.local-ai.yml up -d + ollama pull qwen3:8b' },
  ],
};

// ─── ModelDeck Rate-Limit & Cache Telemetry (timharris707/modeldeck) ─────────

interface ProviderWindowMetric {
  requestsLastMinute: number[];
  requestsToday: number;
  dayKey: string;
  totalTokens: number;
  cacheHits: number;
  errors: number;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastUsedAt: string | null;
}

const providerMetrics = new Map<string, ProviderWindowMetric>();
const promptCache = new Map<string, { content: string; model: string; provider: string; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 250;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureMetric(provider: string): ProviderWindowMetric {
  const day = todayKey();
  const now = Date.now();
  let existing = providerMetrics.get(provider);
  if (!existing) {
    existing = {
      requestsLastMinute: [],
      requestsToday: 0,
      dayKey: day,
      totalTokens: 0,
      cacheHits: 0,
      errors: 0,
      lastError: null,
      lastLatencyMs: null,
      lastUsedAt: null,
    };
    providerMetrics.set(provider, existing);
  }
  if (existing.dayKey !== day) {
    existing.dayKey = day;
    existing.requestsToday = 0;
  }
  existing.requestsLastMinute = existing.requestsLastMinute.filter((t) => now - t < 60_000);
  return existing;
}

export function recordProviderCall(params: {
  provider: string;
  latencyMs: number;
  tokens?: number;
  cached?: boolean;
  error?: string;
}) {
  const m = ensureMetric(params.provider);
  const now = Date.now();
  m.lastUsedAt = new Date(now).toISOString();
  if (params.cached) {
    m.cacheHits += 1;
    return;
  }
  m.requestsLastMinute.push(now);
  m.requestsToday += 1;
  m.lastLatencyMs = params.latencyMs;
  if (typeof params.tokens === 'number' && params.tokens > 0) {
    m.totalTokens += params.tokens;
  }
  if (params.error) {
    m.errors += 1;
    m.lastError = params.error.slice(0, 200);
  } else {
    m.lastError = null;
  }
}

export function getCachedCompletion(cacheKey: string) {
  const hit = promptCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    promptCache.delete(cacheKey);
    return null;
  }
  return hit;
}

export function setCachedCompletion(cacheKey: string, value: { content: string; model: string; provider: string }) {
  if (promptCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = promptCache.keys().next().value;
    if (oldestKey) promptCache.delete(oldestKey);
  }
  promptCache.set(cacheKey, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function getModelDeckTelemetry() {
  return FREE_LLM_PROVIDERS.map((spec) => {
    const m = ensureMetric(spec.id);
    const rpmUsed = m.requestsLastMinute.length;
    const rpmPctLeft = Math.max(0, Math.min(100, Math.round(((spec.rpmEstimate - rpmUsed) / spec.rpmEstimate) * 100)));
    const rpdPctLeft = Math.max(0, Math.min(100, Math.round(((spec.rpdEstimate - m.requestsToday) / spec.rpdEstimate) * 100)));
    const configured = !spec.requiresKey || Boolean(process.env[spec.envKey]?.trim());
    return {
      id: spec.id,
      name: spec.name,
      tier: spec.tier,
      badge: spec.badge || null,
      defaultModel: spec.defaultModel,
      limits: spec.limits,
      signupUrl: spec.signupUrl,
      supportsToolCalling: spec.supportsToolCalling,
      configured,
      rpmUsed,
      rpmLimit: spec.rpmEstimate,
      rpmPctLeft,
      rpdUsed: m.requestsToday,
      rpdLimit: spec.rpdEstimate,
      rpdPctLeft,
      totalTokens: m.totalTokens,
      cacheHits: m.cacheHits,
      errors: m.errors,
      lastError: m.lastError,
      lastLatencyMs: m.lastLatencyMs,
      lastUsedAt: m.lastUsedAt,
    };
  });
}

// ─── Local Zero-API Semantic Vector Engine (128-dim character-trigram + word hash) ───

export function computeLocalSemanticEmbedding(text: string, dims = 128): number[] {
  const vec = new Float64Array(dims);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return Array.from(vec);

  const tokens = normalized.split(' ').filter((w) => w.length >= 2);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Word feature with positional boost for title/lead words
    const weight = i < 12 ? 2.0 : 1.0;
    let h = 2166136261;
    for (let c = 0; c < token.length; c++) {
      h ^= token.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;

    // Character 3-grams for morphological/stem similarity
    const padded = `^${token}$`;
    for (let g = 0; g <= padded.length - 3; g++) {
      const tri = padded.slice(g, g + 3);
      let th = 5381;
      for (let k = 0; k < 3; k++) th = ((th << 5) + th) ^ tri.charCodeAt(k);
      const tIdx = Math.abs(th) % dims;
      vec[tIdx] += ((th & 2) === 0 ? 0.45 : -0.45) * weight;
    }
  }

  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => Number((v / norm).toFixed(6)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ─── Runnable Code Generators (from the Free AI Agent Guide) ─────────────────

export function buildRunnableAgentCode(params: {
  provider: FreeLlmProviderId;
  model: string;
  mcpServers?: string[];
}): {
  listFreePy: string;
  agentPy: string;
  ollamaSetupSh: string;
  mcpConfigJson: string;
} {
  const spec = FREE_LLM_PROVIDERS.find((p) => p.id === params.provider) || FREE_LLM_PROVIDERS[4];
  const baseUrl = spec.id === 'ollama' ? 'http://localhost:11434/v1' : spec.baseUrl;
  const envVar = spec.id === 'ollama' ? 'OLLAMA_API_KEY' : spec.envKey;
  const model = params.model || spec.defaultModel;
  const selectedMcp = params.mcpServers?.length
    ? FREE_INFRA_AND_FRAMEWORKS.mcpServers.filter((m) => params.mcpServers!.includes(m.id))
    : FREE_INFRA_AND_FRAMEWORKS.mcpServers.slice(0, 5);

  const listFreePy = `# list_free.py — List ALL currently-free OpenRouter models
import urllib.request, json

with urllib.request.urlopen("https://openrouter.ai/api/v1/models", timeout=15) as resp:
    data = json.loads(resp.read().decode("utf-8"))["data"]

free = sorted(m for m in (d["id"] for d in data) if m.endswith(":free"))
print(f"{len(free)} free models available right now:\\n")
for m in free:
    print(" •", m)
`;

  const agentPy = `# agent.py — Production Tool-Calling Free AI Agent (with Multi-Provider Fallback)
# Run: pip install openai && export ${envVar}="your-free-key" && python agent.py
import os, json, time, urllib.parse, urllib.request
from openai import OpenAI

PROVIDERS = [
    {"name": "${spec.name}", "base_url": "${baseUrl}", "api_key": os.environ.get("${envVar}", "${spec.id === 'ollama' ? 'ollama' : ''}"), "model": "${model}"},
    {"name": "Groq Fallback", "base_url": "https://api.groq.com/openai/v1", "api_key": os.environ.get("GROQ_API_KEY", ""), "model": "qwen/qwen3-32b"},
    {"name": "OpenRouter :free", "base_url": "https://openrouter.ai/api/v1", "api_key": os.environ.get("OPENROUTER_API_KEY", ""), "model": "qwen/qwen3-32b:free"},
    {"name": "Ollama Local", "base_url": "http://localhost:11434/v1", "api_key": "ollama", "model": "qwen3:8b"},
]

def get_weather(city: str) -> str:
    """Get current weather for any city via Open-Meteo (100% free, no API key)."""
    try:
        geo_url = "https://geocoding-api.open-meteo.com/v1/search?name=" + urllib.parse.quote(city)
        loc = json.load(urllib.request.urlopen(geo_url, timeout=10))["results"][0]
        wx_url = (f"https://api.open-meteo.com/v1/forecast?latitude={loc['latitude']}"
                  f"&longitude={loc['longitude']}&current=temperature_2m,wind_speed_10m")
        cur = json.load(urllib.request.urlopen(wx_url, timeout=10))["current"]
        return f"{loc['name']}, {loc.get('country', '')}: {cur['temperature_2m']}°C, wind {cur['wind_speed_10m']} km/h"
    except Exception as e:
        return f"Weather lookup failed: {e}"

def wikipedia(query: str) -> str:
    """Look up a topic on Wikipedia REST API and return a concise summary."""
    try:
        url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(query.replace(" ", "_"))
        req = urllib.request.Request(url, headers={"User-Agent": "MarketingOS-FreeAgent/1.0"})
        d = json.load(urllib.request.urlopen(req, timeout=10))
        return d.get("extract", "No summary found.")
    except Exception as e:
        return f"Lookup failed: {e}"

TOOLS = [
    {"type": "function", "function": {
        "name": "get_weather",
        "description": "Get the current weather for any city.",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
    }},
    {"type": "function", "function": {
        "name": "wikipedia",
        "description": "Look up a topic on Wikipedia and get a summary.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    }},
]
FUNCS = {"get_weather": get_weather, "wikipedia": wikipedia}

def call_with_fallback(messages):
    last_err = None
    for p in PROVIDERS:
        if not p["api_key"]:
            continue
        client = OpenAI(base_url=p["base_url"], api_key=p["api_key"])
        for attempt in range(2):
            try:
                return client.chat.completions.create(
                    model=p["model"], messages=messages, tools=TOOLS, temperature=0.2
                ), p["name"]
            except Exception as err:
                last_err = err
                if "429" in str(err):
                    time.sleep(2 ** attempt)
                    continue
                break
    raise RuntimeError(f"All configured free providers failed: {last_err}")

if __name__ == "__main__":
    messages = [{"role": "user", "content": "What's the weather in Tokyo and summarize Mount Fuji for a travel campaign."}]
    for step in range(6):
        resp, used = call_with_fallback(messages)
        msg = resp.choices[0].message
        messages.append(msg)
        if not msg.tool_calls:
            print(f"🤖 [{used}]\\n{msg.content}")
            break
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            print(f"🔧 {tc.function.name}({args})")
            result = FUNCS[tc.function.name](**args)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(result)})
`;

  const ollamaSetupSh = `#!/usr/bin/env bash
# 100% Local Zero-API Setup for MarketingOS
set -euo pipefail

ollama pull qwen3:30b-a3b || ollama pull qwen3:8b
ollama pull bge-m3
ollama pull nomic-embed-text

cat << 'ENV'
# Add to MarketingOS .env:
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_CHAT_MODEL="qwen3:8b"
OLLAMA_EMBED_MODEL="bge-m3"
ENV
`;

  const mcpServersMap: Record<string, { command: string; args: string[] }> = {};
  for (const s of selectedMcp) {
    mcpServersMap[s.id] = {
      command: s.pkg.startsWith('@') ? 'npx' : 'uvx',
      args: s.pkg.startsWith('@') ? ['-y', s.pkg] : [s.pkg],
    };
  }

  return {
    listFreePy,
    agentPy,
    ollamaSetupSh,
    mcpConfigJson: JSON.stringify({ mcpServers: mcpServersMap }, null, 2),
  };
}
