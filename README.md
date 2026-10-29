# Kexsio MarketingOS

Self-hosted marketing operations platform with CRM, campaigns, content, SEO, analytics, workflow automation, and AI agent execution.

> **Work in progress — not production-ready.** This branch implements a bounded subset and
> deliberately disables unverified sending, publishing and likeness rendering. It is not an
> autonomous marketing system and has not been deployed or tested with live providers.
> The inventory, blockers and verification limits in [docs/REPOSITORY-AUDIT-2026-10-29.md](docs/REPOSITORY-AUDIT-2026-10-29.md)
> and [docs/TESTING-AND-DEPLOYMENT.md](docs/TESTING-AND-DEPLOYMENT.md) take precedence over
> historical readiness or completeness claims elsewhere in the repository.

## Quick start

Requirements: Node.js 22.23.2, Bun 1.x, and a reachable SQLite database path.

```bash
bash scripts/setup.sh
bun run dev
```

The setup script is re-runnable: it preserves an existing `.env` and database, generates a strong `JWT_SECRET` only when the template value is blank, installs the locked dependencies, generates Prisma Client, applies non-destructive schema changes, and seeds the initial records. It never downloads AI models or overwrites existing credentials. Review `.env` (especially `ADMIN_SEED_PASSWORD`, database location, encryption keys, and AI provider settings) before exposing the service. To skip seeding: `SKIP_SEED=1 bash scripts/setup.sh`.

For production, use the reviewed CI → image build → VPS deploy pipeline in `.github/workflows/`; do not run deployment by manually copying files. Configure the GitHub Actions `DEPLOY_HOST` and `DEPLOY_SSH_KEY` secrets and reconcile the server configuration with `docs/DEPLOYMENT.md`. TLS termination, reverse-proxy and PM2 configurations are checked in under `deploy/` and documented in `docs/DEPLOYMENT-REVERSE-PROXY.md`. Actual remote deployment cannot be enabled until those owner-controlled credentials and a server are configured.

## SetupBot: secure integration onboarding

After signing in, open **Connect → SetupBot** for a Bengali/English, one-question-at-a-time
integration wizard. It saves encrypted, resumable drafts, checks Meta tokens and webhook
challenges, and imports only after explicit confirmation. Configure `CREDENTIAL_ENCRYPTION_KEY`
and HTTPS first. External handoff, Meta API version, custom fields, OTP limitations, data
erasure, and provider-verification boundaries are documented in [docs/SETUP-BOT.md](docs/SETUP-BOT.md).

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

## Agency seed catalog (optional; not evidence of a live workforce)

The platform is one application that serves many clients. A client is configuration, not a deployment.

```bash
npm run agency:seed     # top up 100 departments, 2,000 agent specs, SOPs, department runtimes
npm run backup:now      # take + verify + register a database snapshot
npm run backup:verify   # re-verify the newest snapshot
```

- **100 departments**, each with its own `DepartmentRuntime`: model name, tier, temperature, system prompt,
  guardrails, knowledge scope and SOP binding. Isolation is `local` and fallback is `none` by default, so a
  department fails loudly instead of silently calling a hosted provider.
- The seed script defines up to **2,000 agent specs** (`AGT-0001`…`AGT-2000`) across 20 role archetypes.
  Seeded records are not evidence that agents are running or executing work.
- **120 SOPs**: one delivery procedure per department plus 12 cross-functional playbooks (onboarding, brand
  voice, publishing, SEO content, media, persona consent, SMS, leads, invoicing, backups, access, reporting).
- **Per-client configuration** via `POST /api/clients`: channels, credential mode (`client_login` with
  auto-logout and password rotation, or `managed`), persona limit and a default brand voice — in one call.
- **Brand persona records** store consent references and declared usage scope, but asset ownership and
  consent evidence are not independently verified. Persona rendering and lip-sync are disabled.
- **Verified backups**: `VACUUM INTO` snapshots with SHA-256 checksums, per-table manifests and a restore
  dry-run. `scripts/db-backup.sh` remains the deploy-time safeguard.

Open **Agency Console** in the app, or `GET /api/agency/readiness`, for tenant-scoped readiness information, not an assurance of end-to-end capability. Details and limits: [docs/AGENCY-OPERATIONS.md](docs/AGENCY-OPERATIONS.md).

## Open-source reference library

Every repository, maintainer profile and product site from the project brief is catalogued in
**Ecosystem Library** (`src/components/views/ecosystem-view.tsx`) and in
[`docs/REFERENCE-LIBRARY.md`](docs/REFERENCE-LIBRARY.md). The catalogue is generated, not hand-written:

```bash
node scripts/verify-reference-links.mjs   # re-checks every link via the GitHub API
node scripts/build-reference-library.mjs  # rebuilds the typed catalogue + inventory doc
node scripts/audit-submitted-links.mjs    # audits a submitted batch, duplicates and typos included
```

- Source list: `scripts/data/reference-links.json` (190 unique URLs, de-duplicated)
- Verification snapshot: `docs/link-verification.json`
- Out-of-band checks for hosts the build sandbox cannot reach: `scripts/data/external-verification.json`
- Typed catalogue used by the UI: `src/data/reference-library.ts`
- Per-batch audit: `docs/SUBMITTED-LINKS-AUDIT.md` (79 unique links from the 2026-10-26 submission)
- Read-only JSON API: `GET /api/ecosystem?q=&category=&module=&status=&sort=&limit=`

Statuses describe **this** repository: `adopted` patterns point at the implementing code path,
`blueprint` items are scheduled, `evaluated` items are reference-only, and copyleft licences are
flagged for review. No upstream source, model weights, datasets or assets are bundled.

Every link now carries **how** it was checked (`github-api`, `page-fetch`, `host-probe`) and when.
The build sandbox can only reach GitHub, npm and PyPI, so other websites used to be marked
`external site` without being fetched; they are now checked from a general network and merged in from
`scripts/data/external-verification.json`, with the sandbox's own probe result kept alongside. Only
links that genuinely cannot be read stay marked `access required` (private repositories and
bot-protected pages) — they are never silently dropped.

## Platform areas

- CRM: leads, contacts, deals, tickets
- AI agents and task execution records
- AI content generation, grammar checking, humanization, diagrams, and command chat
- Local image generation and optional self-hosted video/TTS adapters
- Campaigns, content calendar, analytics, SEO, competitor and keyword tracking
- Social account records, integration settings, workflow builder and execution
- Ecosystem library: every brief link verified, classified, mapped to a module and searchable
- Study-abroad intake roadmap: back-planned milestones, readiness score, cost ranges and an exportable plan (deterministic, no model call)
- Agency Console: 100 department runtimes, 2,000 agent specs, SOP library, client provisioning, brand voices, personas and backups with a live readiness audit
- Deployments & Hosting: company-owner/super-admin dashboard for GitHub Actions status and guarded production workflow dispatch, with a shareable project brief for the supplied PM2/Nginx/Cloudflare hosting target
- SMS/OTP, webhooks, audit logs, notifications, team management and settings

## Tech stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Prisma ORM with SQLite in the checked-in schema
- JWT authentication and bcrypt password hashing
- Ollama-first, OpenAI-compatible private inference endpoint optional
- Stable Diffusion WebUI and operator-managed local video/TTS adapters

Social networks, advertising accounts, SMS carriers, and email delivery still require their respective account permissions and/or provider infrastructure. A configured record or integration catalog entry is not proof of a live OAuth connection.
