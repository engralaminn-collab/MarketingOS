# Kexsio MarketingOS

Marketing operations workspace for CRM, campaign/content planning, analytics, market intelligence, team workflows, and AI-assisted drafting. It also contains optional education and workforce modules. The repository is an evolving product—not a claim that every cataloged integration is live or that publishing and media generation are fully autonomous.

## Quick start

Prerequisites: Node.js `22.23.2` and Bun `1.1` or newer. The package declares Node `>=22.23.2 <23.0.0`.

```bash
bun install
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, and (when seeding) ADMIN_SEED_PASSWORD.
bunx prisma generate
bunx prisma db push
bunx tsx prisma/seed.ts
bun run dev
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before deploying. `docker-compose.prod.yml` is a reviewed reference, not proof that the server is running that configuration. Do not deploy until CI, database persistence, secrets, backups, and rollback have been verified for the target environment.

## AI without paid AI APIs

The text-generation adapter defaults to **self-hosted Ollama** (`AI_PROVIDER=ollama`) and has no automatic hosted-provider fallback. Run Ollama yourself, download a compatible model, and configure `OLLAMA_BASE_URL`/`OLLAMA_MODEL`; the optional Docker service is in `docker-compose.local-ai.yml`. Setup, hardware considerations, licensing, and known limitations are in [docs/SELF-HOSTED-AI.md](docs/SELF-HOSTED-AI.md).

Local text inference avoids per-request AI API charges, but it is not equivalent to a hosted premium service in speed, quality, context size, or availability; the product makes no claim to support every model/voice or outperform every paid service. You supply the hardware, power, storage, and model license compliance. Model-based image generation can connect to an operator-hosted ComfyUI checkpoint; MarketingOS does not bundle ComfyUI or model weights. Optional ComfyUI API-workflow support can render short 3–10 second AI video clips, and an OpenAI-compatible local TTS service can generate voiceovers. Neither includes models/services or live inference verification; operators supply hardware, compatible workflows, model licenses, and consent. Local video/audio outputs are session-only and not persisted in the database. Avatar rendering and voice cloning are not implemented. Browser-only social PNG and silent WebM template makers need no API/model, but are not AI-generated imagery or footage. Hosted Z.AI media is disabled unless explicitly enabled, and optional Mureka music is a separate hosted service that may charge. OpenRouter and hosted Z.AI text are opt-in alternatives, not required fallbacks.

## Main areas

- CRM: leads, deals, contacts, and tickets
- Campaigns and content planning, including editable marketing kits and diagrams
- Analytics, market intelligence, competitor/keyword records, and feed headlines
- AI text assistance, agent/workforce workflows, and video-plan/script drafts
- Media Studio, with explicit disclosure of local versus hosted generation
- Team, integrations catalog, notifications, audit logs, and settings
- Education and HR workflows present in the codebase; their end-to-end tenant/security review is still outstanding

The tool catalog currently has **116 unique entries** (with identifier gaps); a catalog entry is not evidence of a completed OAuth flow or live provider connection. Social scheduling is planning only—automatic publishing/sync is not implemented. Messages are internal rather than a unified external inbox. SEO has manual planning/checklists, not live rankings, traffic, or backlink data. The video-plan tool saves a script/storyboard draft only; a separate AI clip action requires a configured local ComfyUI workflow or explicitly enabled hosted provider.

## Development checks

```bash
bun run lint
bun run typecheck
bun run build
```

Current audit findings and known product/security gaps are tracked in [docs/REFERENCE-AND-PROJECT-AUDIT.md](docs/REFERENCE-AND-PROJECT-AUDIT.md), with the full 138-repository link-level inventory in [docs/EXPANDED-GITHUB-REFERENCE-AUDIT.md](docs/EXPANDED-GITHUB-REFERENCE-AUDIT.md). The separate media-reference list is in [docs/OPEN-SOURCE-MEDIA-REFERENCE-REVIEW.md](docs/OPEN-SOURCE-MEDIA-REFERENCE-REVIEW.md). Typecheck/build and live provider validation must pass in an environment with the generated Prisma client and engine binaries before calling the current checkout production-ready.

## Stack

- Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- Prisma 6 with SQLite in the checked-in production compose reference
- Zustand, TanStack Query, shadcn/Radix UI
- JWT sessions (`jose`) and bcrypt password hashing
- Bun for package management/scripts; Node.js for the production runtime
