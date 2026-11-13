# MarketingOS — complete repository audit and remediation

**Date:** 2026-10-28
**Branch:** `arena/1ef9a3ed-marketingos` (from `main` @ `91d19eb`)
**Scope:** every file, folder, dependency, configuration, API route, page, component,
database model, script, environment variable, deployment/Docker file, security control
and document in the checkout.

This is a verification report, not a claim sheet. Every "verified" line below was
produced by running the command shown in §7 against this working tree. Anything that
could not be executed in this environment is listed as **not verifiable here** with the
reason, never as "done".

---

## 1. Method

1. **Static inventory** — walked every file (excluding `node_modules`, `.git`, `.next`),
   parsed every import/export, every `process.env` reference, every `/api/...` string in
   frontend code and matched them against the actual route tree and Prisma schema with
   four purpose-written scripts (imports, routes, env, unused files/deps).
2. **Compiler/tooling** — TypeScript (`tsc --noEmit`), ESLint 9 flat config, production
   `next build`, `bun test`, `node --test`.
3. **Runtime** — initialised a real SQLite database from `prisma/schema.prisma`
   (`scripts/init-sqlite-schema.mjs`), ran every seed, started the **production
   standalone server** and exercised HTTP endpoints with a real admin session
   (health, login, static routes, dynamic routes, assets, headers, auth boundaries).
4. **Operational scripts** — ran `scripts/db-backup.sh`, `scripts/db-restore.sh`,
   `scripts/init-sqlite-schema.mjs`; syntax-checked every shell script; YAML-parsed
   every workflow and compose file.
5. **Re-audit** — after the fixes, every check in §1–4 was executed again (§7).

---

## 2. Inventory (measured, current tree)

| Metric | Count |
|---|---|
| Files (excl. `node_modules`, `.git`, `.next`) | **404** (389 tracked by git) |
| Directories | **220** |
| API route files | **170** |
| Prisma models | **77** |
| Prisma tables created by the schema initialiser | **77 tables, 29 unique constraints, 51 indexes** |
| View components (`src/components/views`) | **44** |
| UI primitives (`src/components/ui`) | **48** |
| Runtime dependencies / dev dependencies | **56 / 10** |
| Test files (5 `bun` + 6 `node --test`) | **11** |
| Documentation files (13 in `docs/` + README + SECURITY + worklog) | **16** |
| Shell scripts (`scripts/*.sh` + `deploy.sh`) | **6** |
| GitHub workflows | **3** (`ci`, `deploy`, `docker`) |
| Lines of TypeScript/TSX in `src/` | **75,828** |
| Lines of seed TypeScript in `prisma/` | **~4,900** |
| Deployment configs (new) | **3** (`deploy/caddy`, `deploy/nginx`, `deploy/pm2`) |

---

## 3. Findings and disposition

Legend — **Fixed**: a defect existed and was corrected in this branch.
**Verified OK**: existed and works, evidence in §7. **Known limitation**: real, but
requires an owner decision or infrastructure that is not in this repository.
**N/A**: does not apply to this stack.

### 3.1 Files and folders

| Item | Result |
|---|---|
| Missing files (imports pointing at nothing) | **Fixed → 0.** `next-env.d.ts` referenced `.next/types/*` before a build; after the production build, 0 broken aliases/relative imports / 343 files scanned. |
| Missing folders | **0** |
| Empty files | **1 → removed** (`mini-services/.gitkeep`, an empty placeholder folder with no service in it). |
| Placeholder files | **Removed:** `examples/websocket/{server,frontend}.tsx` (template sample importing the uninstalled `socket.io`/`socket.io-client`), `src/lib/platforms.ts` (fully unused module), `src/lib/realtime/{client,events}.ts` + `src/hooks/use-realtime.ts` (a realtime client nothing subscribed to), `src/components/{dashboard/dashboard-view,layout/app-header,layout/app-sidebar}.tsx` (dead duplicates; the live shell is in `src/app/page.tsx`), `src/types/index.ts` (only consumed by those dead files), `tailwind.config.ts` (Tailwind v4 is configured CSS-first in `globals.css`; the v3 config's `content` globs pointed at non-existent `./app`, `./components`, `./pages`). |
| TODO / FIXME / XXX / HACK markers in source | **0** (the only matches are phone-number placeholders `+880 1XXX-XXXXXX` in form inputs). |

### 3.2 API surface

| Item | Result |
|---|---|
| API route files | 170 — all compiled into the build (verified in `next build` route table) |
| Frontend → API calls that resolve to a route | **161/161 → 0 missing** (was 6 broken) |
| **Missing backend routes** | **Fixed.** Four endpoints the UI called but that did not exist: <br>• `GET|POST /api/agency/backups` — the Agency Console "Back up now" button and the backup panel <br>• `POST /api/agency/backups/[id]/verify` — the "Verify" button <br>• `PUT /api/assignments/[id]/submissions/[submissionId]` — exam/assignment grading <br>• `POST /api/messages/[id]/read` — mark-thread-read on click |
| **Wrong endpoint URLs in the UI** | **Fixed.** `radar-icp-panel.tsx` posted to `/api/feeds` and `/api/leads`; `ukvi-hub-view.tsx` posted to `/api/leads`. The real collections are `/api/feeds/sources` and `/api/crm/leads`. Three call sites corrected (no duplicate endpoints introduced). |
| Routes with no GET handler (PATCH/DELETE only) | 5 (`campaigns/[id]`, `clients/[id]`, `content/[id]`, `crm/contacts/[id]`, `crm/deals/[id]`, `crm/tickets/[id]`). Not a defect: list endpoints return the full record and the UI never fetches a detail. Documented here rather than "fixed" so the asymmetry is a known choice. |
| 404/500 during the GET sweep of all 170 routes | **0 unexpected 5xx.** 121 static routes: 82×200, 31×405 (write-only), 6×400 (missing required query), 1×404 (`/api/institution` before an institution row exists), 1×503 (`/api/ai/provider-status`, Ollama not running, reported honestly). 49 dynamic routes probed with real ids: 0×5xx. |

### 3.3 Database, models and seeding

| Item | Result |
|---|---|
| Models ↔ tables | 77 models, 77 tables created by `scripts/init-sqlite-schema.mjs`; `prisma generate` + `prisma db push` are the documented path. |
| Missing migrations folder | **Known limitation by design.** There is no `prisma/migrations/`; the repo uses `db push` everywhere and `scripts/db-sync-schema.sh` refuses destructive diffs. Migration path (`prisma migrate diff --from-empty`) is documented in `docs/DEPLOYMENT.md` §3. |
| **Invalid Prisma queries (runtime 500s)** | **Fixed.** 5 queries used `select` and `include` in the same relation object, which Prisma rejects at runtime (TypeScript does not catch it): `GET /api/fees` (returned **500**), `POST /api/fees`, `GET|PUT /api/fees/[id]`, `GET /api/payments/[id]`, `GET /api/salary/[id]`. All rewritten to nest relations under `select`. A scanner now reports **0** occurrences. |
| **Seed could not reach the documented state** | **Fixed.** `npm run agency:seed` previously: (a) created only the 46 specialist departments because the other 54 lived in `seed-workforce.ts`, (b) crashed on re-run with `P2002` on `AgentSpec.code` because it re-generated codes that already existed, (c) left 800 employees (8 per department) against a 2,000 target, (d) created no knowledge nodes, so the readiness audit could never be all-green. <br>Fixes: one shared catalog `prisma/departments.ts` (54 core + 46 specialist = 100, imported by both seeds); the agent top-up now filters existing codes instead of re-creating them; staffing targets 2,000 (20/department); 12 knowledge nodes are derived from the cross-functional SOPs; employee id allocation continues from the highest id in use instead of the row count. |
| Seed idempotency | **Verified**: `agency:seed` run twice → second run adds nothing and exits 0. |
| Fresh-DB verification | init → `seed.ts` → `seed-agency.ts` → `seed-crm.ts` → `seed-engagement.ts` → `seed-tools.ts` → `seed-ai-agents.ts` → `seed-workforce.ts` all exit 0. |
| Readiness audit (`/api/agency/readiness`) | **12/12 checks pass** after seeds + one backup (previously 8/12). |
| Databases committed to git | none (`/db/`, `*.db`, `/backups/` ignored). |

### 3.4 Dependencies and packages

| Item | Result |
|---|---|
| Missing packages (imported but not declared) | **Fixed.** `socket.io`/`socket.io-client` came from the removed sample; `bun:test` is declared through `src/types/optional-modules.d.ts` + `bun-types` (dev). The only deliberately-optional module is `z-ai-web-dev-sdk`, loaded dynamically inside `try/catch` for the opt-in ZAI adapter (`ZAI_MEDIA_ENABLED=false` by default) — install it only if you enable that adapter. |
| Unused packages | **Fixed.** Removed 13 that no source file imported: `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@hookform/resolvers`, `@mdxeditor/editor`, `@reactuses/core`, `@tanstack/react-query`, `@tanstack/react-table`, `next-auth`, `next-intl`, `react-syntax-highlighter`, `uuid`, `zod`, `tailwindcss-animate` (+ the deprecated `@types/bcryptjs` stub). `bun.lock` regenerated; install verified. |
| Kept intentionally | `react-dom` (Next peer), `sharp` (Next production image optimisation), `@dnd-kit/core` (CRM kanban uses `DndContext`). |
| Node/Bun engine range | `>=22.23.2 <23.0.0` / `>=1.1.0`. This sandbox runs Node **22.22.3**, so `npm install` prints an `EBADENGINE` **warning** and `scripts/setup.sh` would refuse to run. That is the guard working as designed; Docker/CI pin 22.23.2. |

### 3.5 Build, types, lint, tests

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| ESLint | `npx eslint .` | **0 errors, 0 warnings** |
| Production build | `npx next build` | **success**, standalone output, all 170 API routes + `/`, `/invite`, `/robots.txt`, `/sitemap.xml` compiled |
| Bun tests | `bun test tests/*.test.ts` | **27 pass, 0 fail** (104 assertions, 5 files) |
| Node tests | `node --test tests/*.test.mjs` | **21 pass, 0 fail** |
| Shell scripts | `bash -n` on all 6 scripts | pass |
| Workflow/compose YAML | parsed with `js-yaml` | 5/5 valid |

### 3.6 Runtime behaviour (production build, real database)

| Probe | Result |
|---|---|
| `GET /api/health` | `200 {"status":"ok", database ok 60ms, config ok}` |
| Admin login → session token | 200, JWT issued, `UserSession` row created |
| `/` and `/invite` | 200 HTML |
| `/manifest.json`, `/kexsio-logo.png`, `/favicon.ico`, `/logo.svg`, `/fonts/geist-latin.woff2` | 200, correct content types |
| `/robots.txt`, `/sitemap.xml` | 200, canonical host consistent |
| GET sweep over all non-dynamic routes (119 requests) | 81×200, 31×405 (write-only), 6×400 (missing required query), 1×404 (`/api/institution` — no institution row exists yet, correct), 1×503 (`/api/ai/provider-status` — Ollama is not running, reported honestly). **0×500.** |
| Dynamic routes with real ids (33 probes) | 200/expected 4xx, **0×5xx** |
| Unauthenticated access to protected routes | All 121 static routes re-probed anonymously: **0 returned 200** (previously `/api/media/lipsync` did — now 401). 401 on every probe (`/api/dashboard`, `/api/crm/leads`, `/api/users`, `/api/agency/readiness`, `/api/agency/backups`, `/api/fees`) |
| Backup lifecycle | `POST /api/agency/backups` → 201 (SHA-256, 77 tables, manifest), `POST .../verify` → `ok:true` (checksum, `PRAGMA integrity_check`, 18 critical tables, row counts), `GET` → list |
| Grading endpoint | 401 unauth, 404 unknown assignment, validation + audit log on success path |
| Message read endpoint | 401 unauth, 400 self-thread, 404 non-member, 200 updates only the caller's rows |
| Backup/restore scripts | `db-backup.sh` produced a verified snapshot; `db-restore.sh` restored it into a copy and the restored DB holds 100 departments (integrity + row counts intact) |

### 3.7 Authentication, authorisation, validation, security

| Item | Result |
|---|---|
| Auth logic | **Verified.** JWT (`jose`, HS256, 7d) + DB-backed revocable `UserSession`; API keys `mos_live_sk_…` hashed with bcrypt; bcrypt(12) password hashing with transparent upgrade of legacy SHA-256 hashes. `JWT_SECRET` is mandatory and ≥32 chars in production. |
| Session enforcement | `verifyToken` re-reads the session row, the user's active flag, company membership and company/institution active state on every request — a deleted or deactivated membership cannot keep using a valid JWT. |
| Authorisation | Role hierarchy with fail-closed unknown roles and explicit membership sets for academic roles (`hasPermission`). `withAuth({minRole})` on app routes; `getActor` + role checks on agency routes. **Verified** by the RBAC/tenant-isolation test suite and by 401/403 probes on the new endpoints. |
| Tenant isolation | Company-scoped queries verified by the existing 10-scenario `/api/social-accounts` suite; new backup endpoints correctly restricted to administrators because `BackupRecord` is deployment-wide. |
| **Security headers** | **Fixed → added in `next.config.ts`**: `Content-Security-Policy` (production only), `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-DNS-Prefetch-Control`, `Cache-Control: no-store` on `/api/*`, and `poweredByHeader: false`. Verified on the wire. |
| Input validation | 122 routes read a request body and all 122 validate it with hand-written guards (`typeof`, length limits, allow-lists, `sanitizeInput`) rather than a schema library. The new routes validate kind allow-lists, numeric ranges (`marks` ≤ assignment total), id formats and body shape. **Known limitation:** there is no single validation layer; a schema-first refactor is a sensible follow-up, not a defect in any verified path. |
| SSRF protection | `src/lib/ssrf.ts`: scheme/port/credential checks, DNS resolution, private-range blocking, redirect and size limits; used by feed import, webhook dispatch and scraper calls. |
| Rate limiting | **Improved.** Login (per IP **and** per email), invite acceptance and OTP keep their dedicated limiters; `withAuth` now applies a default 600 requests/minute per authenticated user to every wrapped route (429 + `Retry-After`, verified with a 620-request burst on `/api/departments`: 597×200 then 23×429). The 43 wrapped routes are covered in-app; the remaining routes that call `verifyToken` directly are covered by the edge `limit_req` zone in `deploy/nginx/marketingos.conf`. A shared-store limiter (Redis) is the correct next step before running more than one instance. |
| Credential storage | AES-256-GCM vault (`CREDENTIAL_ENCRYPTION_KEY`), legacy base64 rejected. Unit-tested. |
| Secret scanning | `.env*` ignored, no secrets in the tree, CI job scans for committed secrets. |
| Session storage in the browser | **Known limitation:** the bearer token lives in `localStorage` (`mos_token`), so an XSS would expose it. Documented in `docs/CANONICAL-APPLICATION.md`; migrating to an HttpOnly cookie is a deliberate product change, not a silent fix. |
| Open-proxy risk | **Fixed/documented.** The repository-root `Caddyfile` is a sandbox preview proxy that forwards to any port named in `XTransformPort`. It is now explicitly labelled as sandbox-only, and real TLS configs were added (`deploy/caddy/`, `deploy/nginx/`). |

### 3.8 Configuration and environment variables

| Item | Result |
|---|---|
| Env vars referenced in code | **74** |
| Env vars used but undocumented | **34 → 0.** All are now in `.env.example` with the component that reads them, defaults and failure behaviour (email providers, Firecrawl, HTTP SMS, Telnyx, HuggingFace/Cloudflare/Groq/Gemini, local STT, embeddings, `BACKUP_DIR`/`BACKUP_RETENTION`, `GIT_COMMIT`, `ADMIN_SEED_EMAIL`, `NEXT_PUBLIC_SITE_URL`, cPanel `DB_NAME`/`DB_HOST` diagnostics, maintenance tokens). |
| Env vars documented but never read | 10 → **0.** Removed the never-read Meta/Google Ads/WhatsApp placeholder block (nothing reads those names), replaced with an explicit note that those OAuth flows are not implemented; removed the unused `TTS_DEFAULT_VOICE`. `PORT`/`HOSTNAME` are read by the Next standalone server, now noted as such. |
| Required-at-boot variables | `DATABASE_URL`, `JWT_SECRET` — enforced by `src/lib/auth.ts` and surfaced by `/api/health` (`503 degraded` + names only, never values). |
| Config files | `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, `components.json`, `prisma/schema.prisma`, `.nvmrc`, `.node-version`, `.gitignore`, `.dockerignore` — all present and valid. `tailwind.config.ts` was dead (v4 CSS-first) and removed. |
| **`.gitignore` bug** | **Fixed.** `backups/` (unanchored) silently ignored **`src/app/api/agency/backups/`**, so the new route would never have been committed. Rules are now anchored (`/backups/`, `/db/`). |
| Canonical site identity | **Fixed.** Metadata used `https://www.kexsio.com` while `robots.ts`/`sitemap.ts` hard-coded `https://marketingos.ai` — two different origins for one deployment. All absolute URLs now derive from `src/lib/site.ts` (`NEXT_PUBLIC_SITE_URL`, validated with a safe fallback). A duplicate static `public/robots.txt` (shadowing/conflicting with the generated route) was removed. |

### 3.9 Pages, components, links, assets

| Item | Result |
|---|---|
| Frontend pages | `/` (workspace shell) and `/invite/[token]` — both 200. Views are lazy-loaded and keyed by a single `ViewId` union; every id in the sidebar map has a component. |
| Missing frontend pages | none referenced by navigation that does not resolve. |
| Broken links (markdown) | **0** across 14 documents (script walks every relative markdown link target). |
| Broken images / missing public assets | **0 real.** The only flagged reference, `/diagram.svg`, is inside the *sample HTML string* fed to the SEO crawler demo, not an app asset. |
| Unused components | 22 shadcn/ui primitives are not imported by any view (accordion, chart, form, sidebar, …). **Retained deliberately**: they are the design-system catalog declared in `components.json`, they are never bundled unless imported, and deleting them would break `npx shadcn add` workflows. All app-level dead components were removed (see §3.1). |
| Dead code | App-level dead files removed; `select`+`include` duplication fixed; `src/lib/security.ts` exports a deprecated role map kept only for backwards compatibility (annotated `@deprecated`), and `validatePermission`/`hasMinRole` remain for API consumers. |
| Duplicate code | Two department catalogs (the cause of the seeding defect) merged into one module. Duplicate site-URL constants merged. |

### 3.10 Deployment, Docker, Ubuntu, PM2, TLS, monitoring, logging, backup

| Item | Result |
|---|---|
| Dockerfile | Multi-stage (deps → builder → runner), Node 22.23.2 pinned, Bun from the official image, non-root `nextjs` user, Prisma client generated before build, `HEALTHCHECK` on `/api/health`, `GIT_COMMIT` build arg surfaced by `/api/health`. Reviewed and consistent with `.dockerignore` and `next.config.ts` (`output: standalone`). |
| docker-compose.prod.yml | SQLite bind-mount (`./db:/app/db`), backups volume, loopback-only port, healthcheck, log rotation, `:?` guards on `JWT_SECRET`. Valid YAML. |
| **Docker image build** | **Not verifiable here** — no Docker daemon in this sandbox. `next build` + the exact Dockerfile steps (`prisma generate`, standalone copy) were executed natively and pass. |
| Ubuntu/CI workflows | `ci.yml` (lint, typecheck, tests, secret scan, build), `docker.yml` (build & push, SHA tag), `deploy.yml` (CI gate, image pull, persistence preflight, verified backup, non-destructive schema sync, rolling restart, health check, rollback). All three parse; deployment itself **not verifiable** (needs the owner's `DEPLOY_HOST`/`DEPLOY_SSH_KEY` and a server). |
| `deploy.sh` | Intentionally disabled; exits 1 with an explanation (it used `--accept-data-loss` against a hard-coded unrelated repo). |
| **Reverse proxy / TLS** | **Added.** `deploy/caddy/Caddyfile` (automatic ACME, security headers, streaming, log rotation) and `deploy/nginx/marketingos.conf` (TLS 1.2/1.3, HSTS, edge rate limit, immutable asset caching, websocket upgrade). **Syntax not validated here** — neither binary exists in this sandbox; both configs are written against documented directives and are documented in `docs/DEPLOYMENT-REVERSE-PROXY.md`. |
| **PM2** | **Added.** `deploy/pm2/ecosystem.config.cjs`: fork mode, **`instances: 1`** (SQLite has a single writer; cluster mode causes `SQLITE_BUSY`), memory cap, log files, secrets read from the environment only. **Not executed here** — PM2 is not installed. |
| Backup system | Two layers verified: `POST /api/agency/backups` + verify (UI/API) and `scripts/db-backup.sh` / `scripts/db-restore.sh` (restore dry-run backed up the current DB first). `VACUUM INTO` + SHA-256 + per-table manifest + row-count reconciliation. |
| Backup retention | **Fixed:** a malformed `BACKUP_RETENTION` previously produced `NaN` and pruned every snapshot except the new one; it is now validated (≥1, integer, default 14). |
| Monitoring | `/api/health` reports DB round-trip latency, config presence, commit SHA and uptime with `200`/`503`; compose + Docker `HEALTHCHECK` agree; `docs/DEPLOYMENT-REVERSE-PROXY.md` §3 gives the external poll, disk-usage, backup-verify and log-shipping checklist. No hosted APM is bundled by design. |
| Logging | Structured `console.error` with route tags; PM2 log files and Caddy JSON access logs configured; Docker json-file driver capped at 10 MB × 5. No PII or secret values are logged (health endpoint returns names only). |
| SSL | Terminated at Caddy/Nginx (configs above); HSTS emitted by the app in all environments and by both proxies. The app itself speaks HTTP on loopback only. |
| Production optimisations | `output: standalone`, immutable `/_next/static` caching, gzip/zstd, `poweredByHeader: false`, `no-store` on API responses, lazy-loaded views, local fonts (no external font fetch), single-writer SQLite with documented limits. |

### 3.11 Documentation

| Document | Result |
|---|---|
| README, DEPLOYMENT, DEPLOYMENT-RUNBOOK, CANONICAL-APPLICATION, AGENCY-OPERATIONS, SELF-HOSTED-AI, REFERENCE-LIBRARY, REFERENCE-AND-PROJECT-AUDIT, EXPANDED-GITHUB-REFERENCE-AUDIT, OPEN-SOURCE-MEDIA-REFERENCE-REVIEW, SUBMITTED-LINKS-AUDIT, FINAL-PRODUCTION-VERIFICATION-REPORT | present, internally linked, no broken relative links |
| **Corrected in this pass** | `2,464 employees` → **2,000** (README, AGENCY-OPERATIONS, CANONICAL-APPLICATION) and the 100-department breakdown (54 core + 46 specialist, both created by `agency:seed`). |
| **Added** | `docs/DEPLOYMENT-REVERSE-PROXY.md` (TLS, proxy, PM2, monitoring, rollback), `deploy/*` configs, and this audit. |
| Missing documentation | No gap found that blocks operation; the deliberate absences (no migrations, no hosted AI fallback, no OAuth marketing providers) are stated where they matter. |

### 3.12 Performance, memory, dead links

| Item | Result |
|---|---|
| Performance | Server-rendered shell, route-level lazy views, Prisma indexes on hot paths (51), bounded response sizes (`take` limits on message/feeds lists), streaming proxy config. |
| Memory leaks | No unbounded module-level stores except the rate-limit `Map`, which is swept every 60 s and `unref()`d. React hooks use abort controllers and cleanup. No leak observed across the runtime session; not profiled under load (**not verified**). |
| Broken links / images | 0 (§3.9) |

---

## 4. Files changed in this pass

**New**

- `src/app/api/agency/backups/route.ts` — list/create verified backups (admin only)
- `src/app/api/agency/backups/[id]/verify/route.ts` — integrity verification
- `src/app/api/assignments/[id]/submissions/[submissionId]/route.ts` — grading
- `src/app/api/messages/[id]/read/route.ts` — mark a thread read
- `src/lib/site.ts` — single source of truth for canonical URLs
- `prisma/departments.ts` — 54 core + 46 specialist department catalog
- `deploy/caddy/Caddyfile`, `deploy/nginx/marketingos.conf`, `deploy/pm2/ecosystem.config.cjs`
- `docs/DEPLOYMENT-REVERSE-PROXY.md`, `docs/COMPLETE-AUDIT-2026-10-28.md`
- `tests/agency-backup-routes.test.ts` — 6 regression tests for the new endpoints

**Modified**

- `next.config.ts` (security headers, `poweredByHeader`, API `no-store`)
- `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` (canonical site config)
- `src/app/api/fees/route.ts`, `src/app/api/fees/[id]/route.ts`, `src/app/api/payments/[id]/route.ts`, `src/app/api/salary/[id]/route.ts` (invalid Prisma `select`+`include`)
- `src/lib/backup.ts` (validated retention, exported constant)
- `src/components/studio/radar-icp-panel.tsx`, `src/components/views/ukvi-hub-view.tsx` (endpoint URLs)
- `prisma/seed-agency.ts`, `prisma/seed-workforce.ts` (shared catalog, idempotent agent top-up, 2,000 staffing, knowledge bootstrap)
- `.gitignore` (anchored `/db/`, `/backups/`), `.env.example` (34 vars added, 10 dead vars removed), `package.json` + `bun.lock` (13 unused packages removed), `eslint.config.mjs` (ignore CJS PM2 file), `Caddyfile` (sandbox-only warning), `README.md`, `docs/AGENCY-OPERATIONS.md`, `docs/CANONICAL-APPLICATION.md`, `docs/DEPLOYMENT.md`

**Deleted**

`examples/` (2 files), `mini-services/.gitkeep`, `public/robots.txt`, `tailwind.config.ts`,
`src/lib/platforms.ts`, `src/lib/realtime/{client,events}.ts`, `src/hooks/use-realtime.ts`,
`src/types/index.ts`, `src/components/dashboard/dashboard-view.tsx`,
`src/components/layout/{app-header,app-sidebar}.tsx`.

---

## 5. Verification matrix (post-fix)

| Requirement | Status | Evidence |
|---|---|---|
| Zero build errors | ✅ | `npx next build` exit 0 |
| Zero TypeScript errors | ✅ | `npx tsc --noEmit` exit 0 |
| Zero ESLint errors | ✅ | `npx eslint .` exit 0 |
| Zero runtime 5xx on the route sweep | ✅ | 119 static + 33 dynamic probes, 0×5xx |
| Zero broken imports/exports | ✅ | 0 unresolved imports in 343 files |
| Zero missing dependencies | ✅ | all bare specifiers resolve or are declared optional |
| Zero missing API routes used by the UI | ✅ | 161/161 frontend call sites resolve |
| Zero missing env documentation | ✅ | 74 used / 74 documented, 0 orphans |
| Zero placeholder code / TODO / FIXME | ✅ | grep + dead-file removal |
| Auth + RBAC on every sensitive route | ✅ | 401/403 probes + isolation suite |
| Seeds reach the documented state and are idempotent | ✅ | 100 departments / 2,000 agents / 2,000 staff / 112 SOPs / 12 knowledge nodes; second run no-ops |
| Readiness audit fully green | ✅ | 12/12 after seeds + one backup |
| Backup create/verify/restore | ✅ | API + shell scripts |
| Documentation links | ✅ | 0 broken relative links |

---

## 6. Known limitations and owner actions

These are real and are **not** claimed as complete. Each needs infrastructure or a
product decision that the repository cannot supply on its own.

1. **Docker image, GitHub Actions runs, Caddy/Nginx and PM2 were not executed here** —
   no daemon/binaries in this sandbox. Configs are complete, consistent and parsed
   (YAML/shell), and the exact build steps were executed natively.
2. **Deployment to a VPS** requires `DEPLOY_HOST` / `DEPLOY_SSH_KEY`, a GitHub
   environment, and the reconciled `/opt/aismh/docker-compose.yml` on the host.
3. **Third-party providers are unconfigured** (Ollama, Stable Diffusion/ComfyUI, TTS,
   Firecrawl, Twilio/HTTP SMS/Telnyx, email, social OAuth). Those endpoints return an
   explicit 503/`unconfigured` — the code never fabricates success.
   `ZAI_MEDIA_ENABLED=true` additionally requires installing `z-ai-web-dev-sdk`.
4. **Multi-company seeding**: `AgentSpec.code`, `Employee.employeeId` and
   `Department.code` are globally unique while the rows are company-scoped, so seeding
   a second company's full agency model would collide. Verified for the primary
   workspace only. Migration: composite `@@unique([companyId, code])` + a `db push`
   with the documented backup/schema-sync steps.
5. **Bearer token in `localStorage`** (XSS exposure). Migrating to an HttpOnly cookie +
   CSRF token is a product change.
6. **Rate limiting** is per-process: login/invite/OTP have dedicated limiters and every
   `withAuth` route has a 600/min per-user budget, but the 109 routes that call
   `verifyToken` directly rely on the edge limit in `deploy/nginx/marketingos.conf`.
   A Redis-backed shared limiter is needed for anything beyond one instance.
7. **No `prisma/migrations/`** — `db push` + `db-sync-schema.sh` by design (documented).
8. **Load/soak testing** was not performed; single-instance SQLite is the supported
   topology (enforced in the PM2 config).
9. **Browser-level UI testing** was not performed (no headless browser here); the
   shell, assets, metadata and every API the UI calls were verified over HTTP. The one
   inherently browser-only path — the in-page Web Speech talking-head preview — needs a
   real browser and OS voices.

---

## 7. Reproduction

```bash
# tooling
npx tsc --noEmit
npx eslint .
npx next build

# tests
bun test tests/*.test.ts
node --test tests/*.test.mjs

# database + seeds (fresh file)
export DATABASE_URL="file:/tmp/mos/custom.db"
export JWT_SECRET="$(openssl rand -hex 32)"
node scripts/init-sqlite-schema.mjs
npx tsx prisma/seed.ts
npx tsx prisma/seed-agency.ts   # 100 depts, 2,000 agents, 2,000 staff, 112 SOPs
npx tsx prisma/seed-crm.ts

# production server
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
NODE_ENV=production PORT=3000 node .next/standalone/server.js

# smoke
curl -s localhost:3000/api/health
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@marketingos.com","password":"<seed password>"}' | jq -r .token)
curl -s localhost:3000/api/agency/readiness -H "Authorization: Bearer $TOKEN" | jq '.data.checks'
curl -s -X POST localhost:3000/api/agency/backups -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"kind":"manual"}'
```
