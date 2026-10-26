# Canonical application and scope

> This replaces the older sandbox-specific memo in this file. It describes the current MarketingOS checkout; it is an architecture note, not a production verification. For current findings and validation limits see [the consolidated audit](REFERENCE-AND-PROJECT-AUDIT.md).

## Application

The canonical application is the Next.js App Router product at the repository root. There is no nested `english-aloeducation/` application in this checkout.

- `src/app/` — app pages and API routes
- `src/components/` — UI primitives, layout, and product views
- `src/hooks/` and `src/stores/` — client hooks and Zustand app state
- `src/lib/` — authentication, provider adapters, API helpers, validation, and domain services
- `prisma/schema.prisma` — current data model; SQLite is the configured provider
- `prisma/seed*.ts` — seed/bootstrap scripts

The codebase contains CRM, campaigns/content, analytics, feeds/market intelligence, integrations, AI workflows, and education/workforce areas. Presence in the repository does not by itself prove a feature is end-to-end complete, tenant-safe, provider-connected, or production tested.

## Runtime and persistence

- Package/runtime requirements are declared in `package.json`, `.nvmrc`, `.node-version`, and `Dockerfile` (Node 22.23.2 for production; Bun for package/scripts).
- The checked-in production Compose reference uses SQLite at `/app/db/custom.db` and mounts `./db:/app/db`.
- `docker-compose.prod.yml` is explicitly a reviewed reference. The deployment workflow says the live server Compose file is outside version control; reconcile and verify it on the target host before deployment.
- Database schema changes use the repository's `db push` workflow and backup/schema-sync scripts; inspect `docs/DEPLOYMENT.md` for the safeguards. This is not a claim that a deployment or restore has been tested in the current session.

## Authentication and data boundaries

- API authentication uses JWT session tokens signed with `jose`; password hashing uses `bcryptjs`.
- The browser stores the bearer token in `localStorage` (`mos_token`). Treat this as an XSS exposure risk; an HttpOnly-cookie migration has not been done.
- `useAuth` now adapts the shared Zustand session state so views no longer depend on an unmounted, divergent auth context.
- CRM and some other APIs apply company scoping. Education/workforce route coverage and cross-tenant access need a dedicated full review before production use; see the audit.

## AI and integrations

- Text generation defaults to self-hosted Ollama; OpenRouter and hosted Z.AI text require explicit selection. There is no intended automatic paid-provider fallback.
- An optional self-hosted ComfyUI checkpoint workflow is wired for image generation, and a configurable ComfyUI API-workflow adapter can render 3–10 second AI clips. An OpenAI-compatible local TTS adapter can synthesize voiceovers. No ComfyUI server, workflow, model, TTS service, or weights are bundled or live-tested; local video/audio outputs are session-only, and configured local failures do not fall back to hosted services. Avatar generation and voice cloning are not implemented. Browser-only PNG and silent WebM templates use no API/model and are not AI-generated art or footage. Hosted Z.AI media is disabled by default; optional Mureka music may incur charges.
- The seed catalog has **116 unique tool-number entries**, with gaps at 16, 17, 18, and 115. These are catalog definitions, not 116 verified/live integrations. Music is tool #120, leaving identifier gaps rather than a continuous 1–120 list.
- Social publishing/sync, a unified external inbox, live rank/traffic/backlink SEO data, and production-ready end-to-end video generation are not implemented. The local video adapter is a configurable workflow hook, not a bundled or verified model pipeline. A silent browser-generated WebM text-card template is available for download.

## Agency operating model

- `DepartmentRuntime` gives every department its own model profile (prompt, tier, temperature, guardrails, knowledge scope, SOP binding). `isolationMode=local` and `fallbackPolicy=none` are the defaults; the readiness audit fails if a hosted provider key is configured or a department allows fallback.
- `AgentSpec` holds 2,000 executable agent definitions; `Employee` holds the 2,464 staff that run them. Departments, agents and SOPs are data rows, so growth needs no deploy.
- A client is a `Company` + `ClientConfig` row (`POST /api/clients`), with `credentialMode`, `autoLogoutMinutes`, `passwordRotationDays`, allowed channels and a default `BrandVoice`. There is no per-client application, fork or deployment.
- `BrandPersona` builds face agents only from client-supplied photos and refuses to activate or render without recorded consent and an in-scope channel.
- Backups: `scripts/db-backup.sh` for deploy-time safety, `scripts/agency-backup.ts` for scheduled snapshots verified against a manifest. `./db` and `./backups` are gitignored and must be replicated off-host by the operator.
- See [AGENCY-OPERATIONS.md](AGENCY-OPERATIONS.md) for the requirement-to-evidence table and the honest limits (no model weights or media generators are bundled).

## Reference library

- `scripts/data/reference-links.json` is the reviewed list of every link supplied in the briefs (190 unique URLs after de-duplication).
- `scripts/verify-reference-links.mjs` re-checks each link through the GitHub REST API for repositories and profiles, and records HTTP 403 or sandbox-blocked sites as such rather than guessing.
- `scripts/build-reference-library.mjs` validates the result (malformed URLs, duplicates, unknown statuses, adopted claims without an existing evidence file) and regenerates `src/data/reference-library.ts`, `docs/REFERENCE-LIBRARY.md` and the Ecosystem Library screen.
- "Adopted" means a pattern is implemented natively and the cited code path exists in this repository. It does not mean upstream code was copied. Copyleft references are recorded under licence review.

## Source of truth

- Setup and local-AI limits: [SELF-HOSTED-AI.md](SELF-HOSTED-AI.md)
- Deployment and persistence: [DEPLOYMENT.md](DEPLOYMENT.md), `docker-compose.prod.yml`, `.github/workflows/`
- Reference and project audit: [REFERENCE-AND-PROJECT-AUDIT.md](REFERENCE-AND-PROJECT-AUDIT.md)
- Full link inventory and adoption status: [REFERENCE-LIBRARY.md](REFERENCE-LIBRARY.md)
- Agency specification, department models, client provisioning and backup policy: [AGENCY-OPERATIONS.md](AGENCY-OPERATIONS.md)

The old `docs/DEPLOYMENT-RUNBOOK.md` and `docs/FINAL-PRODUCTION-VERIFICATION-REPORT.md` refer to a different sandbox path/repository snapshot. They are marked as historical and must not be treated as current deployment instructions or evidence.
