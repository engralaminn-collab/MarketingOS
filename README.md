# Kexsio MarketingOS

Self-hosted marketing operations platform with CRM, campaigns, content, SEO, analytics, workflow automation, and AI agent execution.

## Quick start

Requirements: Node.js 22.23.2, Bun 1.x, and a reachable SQLite database path.

```bash
bun install
cp .env.example .env
# Set JWT_SECRET to a fresh secret and set ADMIN_SEED_PASSWORD for seeding.
openssl rand -hex 32
mkdir -p db
bunx prisma generate
bunx prisma db push
bunx tsx prisma/seed.ts
bun run dev
```

## Self-hosted AI

Text generation defaults to **Ollama**. MarketingOS does not automatically fall back to a paid cloud AI provider. If Ollama is down, the request returns an explicit error or a clearly degraded rule-based result.

```env
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_CHAT_MODEL="qwen2.5:7b"
```

Install Ollama on the same host or a private trusted network, pull a model that fits available RAM/VRAM, and verify the Ollama API is reachable from the MarketingOS runtime. For example, run `ollama pull qwen2.5:7b` on the machine hosting Ollama. A model is not downloaded automatically by the application.

### Local image, video, and speech generation

- **Images:** configure `IMAGE_GENERATION_URL` to a self-hosted Stable Diffusion WebUI API (AUTOMATIC1111-compatible `/sdapi/v1/txt2img`).
- **Video:** configure `VIDEO_GENERATION_URL` to a private self-hosted adapter implementing `POST /generate` and `GET /status/:taskId`. The adapter must return JSON containing a task ID and, when ready, a video URL.
- **Speech:** configure `TTS_SERVICE_URL` to a private self-hosted adapter implementing `POST /api/tts` with JSON `{ "text": "...", "voice": "default" }` and returning `audioUrl`, `audio_url`, or `audioBase64`.

These services are optional. Missing or unreachable media services fail explicitly and do not call a hosted generation provider. Video reference-image conditioning depends on the local video adapter and its model; a voice preset is not voice cloning.

Do not expose local model ports directly to the public internet. Put them on a private network, apply authentication at the adapter or network layer, and set resource limits. Model weights, GPU/CPU hardware, electricity, storage, and maintenance still have costs even without per-request AI API fees.

## Production

```bash
bun run lint
bun run typecheck
bun run build
```

Production uses the SQLite database configured in `prisma/schema.prisma`; the database file must live in the persistent `./db` volume described in `docker-compose.prod.yml`. Back up both the database and the credential-encryption key. SQLite is suitable for smaller/self-hosted deployments but should be load-tested before multi-user high-write production use.

## Platform areas

- CRM: leads, contacts, deals, tickets
- AI agents and task execution records
- AI content generation, grammar checking, humanization, diagrams, and command chat
- Local image generation and optional self-hosted video/TTS adapters
- Campaigns, content calendar, analytics, SEO, competitor and keyword tracking
- Social account records, integration settings, workflow builder and execution
- SMS/OTP, webhooks, audit logs, notifications, team management and settings

## Tech stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Prisma ORM with SQLite in the checked-in schema
- JWT authentication and bcrypt password hashing
- Ollama-first, OpenAI-compatible private inference endpoint optional
- Stable Diffusion WebUI and operator-managed local video/TTS adapters

Social networks, advertising accounts, SMS carriers, and email delivery still require their respective account permissions and/or provider infrastructure. A configured record or integration catalog entry is not proof of a live OAuth connection.
