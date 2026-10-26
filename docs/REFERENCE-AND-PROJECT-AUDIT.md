# MarketingOS reference and project audit

**Audit date:** 2026-10-17  
**Verdict:** **Not complete and not production-verified.** This report records a broad repository audit, targeted reference review, and feasible remediation; it is not a claim that every route, reference asset, integration, or deployment has been exhaustively tested.

## 1. Scope and confidence

- The MarketingOS checkout was reviewed across the app shell, major UI modules, Prisma/authentication, representative API routes, AI adapters, Compose/deployment files, project documentation, and seed definitions.
- The expanded GitHub list is deduplicated into **138 unique repositories**. Metadata, README, and root listings were retrieved for **135**; the GitHub license endpoint returned a file for **113**. Three repositories under `engralaminn-collab` returned HTTP 403 (public pages also returned 404). A durable row-by-row inventory, metadata license status, link-level review status, and relevance/reuse disposition is in [EXPANDED-GITHUB-REFERENCE-AUDIT.md](EXPANDED-GITHUB-REFERENCE-AUDIT.md). Selected source files were additionally reviewed for relevant diagrams, campaign kits, SEO/CRO, lead enrichment, market intelligence, CRM, scraping, and media. **The 138-repository work is link/README/root-level triage—not a file-by-file source, dependency, model-weight, or legal audit.**
- A separate supplied media list was deduplicated to **33 unique GitHub repositories and 9 website links**. GitHub metadata, README, root listings, and license files were checked where available; detailed findings remain in [OPEN-SOURCE-MEDIA-REFERENCE-REVIEW.md](OPEN-SOURCE-MEDIA-REFERENCE-REVIEW.md). It is not a full source-code/dependency audit of every linked repository.
- No production environment, VPS configuration, database, local Ollama model, ComfyUI server/checkpoint/video workflow, local TTS service/model, or hosted provider key was available. No end-to-end or live-provider verification is claimed.

## 2. Reference review and disposition

> **Update 2026-10-26:** the link-level inventory is now generated and versioned in
> [REFERENCE-LIBRARY.md](REFERENCE-LIBRARY.md). It covers **190 unique links** (including maintainer
> profiles and product sites, not only repositories), re-checks each GitHub link, keeps HTTP 403 and
> sandbox-blocked links visible, and records an implementation evidence path for every "adopted"
> pattern. The dispositions below are the 2026-10-17 snapshot and remain valid; where they differ from
> the generated library, the generated library plus `docs/link-verification.json` are authoritative.

| Reference pattern | Decision and current state |
|---|---|
| Marketing kits, diagrams, CTA/design references | Applicable. Marketing Studio now has 9 deterministic kit types, including SEO briefs/CRO experiments/case studies/referrals, Markdown download, 7 editable branded SVG diagram layouts with light palette tokens and 2× PNG export, and CTA HTML copy/download with contrast checks. Patterns were adapted; upstream source/assets were not copied. Browser/accessibility review across all screen sizes remains outstanding. |
| SEO, CRO, copy, analytics and campaign references | Applicable to planning and validation. SEO/content/campaign/competitor/keyword APIs received validation and persistence hardening. MarketingOS still does not have a verified live SERP/rank, traffic, backlink, or ad-performance provider. |
| Lead-enrichment references | Applicable in a limited, no-enrichment-API form: server-side domain-derived enrichment is available. It is not equivalent to licensed contact-data or paid enrichment services. |
| Firecrawl and scraper references | Added optional `FIRECRAWL_BASE_URL` support with no hosted default or silent fallback; the built-in DNS-pinned/no-redirect fetcher remains default. MarketingOS pre-validates target URLs, but a separately operated crawler must enforce its own SSRF/egress policy. No Firecrawl runtime/source was bundled. |
| Market-intelligence references | MarketingOS remains manual competitor/keyword tracking plus name-matched feed headlines; the Market Intelligence Radar’s automated article extraction, entity matching, enrichment, and approval queue were not cloned. The Firecrawl reference informed a separate opt-in scrape adapter; this does not turn Market Intelligence into an automated radar or verified market-data service. |
| Buffer publishing/analytics | Scheduling, platform-specific publishing, approvals, and analytics are useful product patterns. MarketingOS does not have provider OAuth/publishing/sync adapters; `scheduledAt` is planning data, not automatic publishing. |
| SuperCool end-to-end UGC/ad creation | Relevant as a product direction, but not achieved. MarketingOS creates plans/drafts and editable kits; it does not produce fully rendered ad assets and autonomously post them end to end. |
| AIPraktor messaging/commerce | External messaging, commerce checkout, and courier workflows were not transplanted. MarketingOS messages are internal; it has no unified provider-connected customer inbox or commerce/courier flow. |
| Enerpize service-business ERP | CRM and campaign operations are relevant. Full accounting, invoicing, and inventory are not included in this marketing scope. |
| Qwen Code and Cline | Coding-agent products, not marketing-product capabilities. No code-agent runtime was transplanted into MarketingOS. |
| Meta AI image generation | No supported public developer API contract was verified for the reviewed feature; no Meta image adapter was added. |
| Stack Overflow AI Assist | Citation/provenance is a useful trust pattern, but a community developer Q&A product is not a MarketingOS feature. |
| ToolJet/admin tooling and education references | Reviewed for relevant admin/education patterns. Their unrelated runtimes and infrastructure were not copied. Education/HR modules exist in this repository, but their tenant/security review is incomplete. |
| Ollama | Applicable to the user's no-paid-AI-API preference. A server-side Ollama text adapter is the default, and an optional private-network Compose overlay is included. Neither has been live-tested here. |
| OpenRouter and Z.AI | Retained only as explicitly selected hosted text-provider alternatives. They are not required fallbacks and do not satisfy a strict no-paid-API guarantee. |
| Mureka | Added as an optional instrumental-generation integration. It is a separate hosted service, may incur charges, and is not part of the no-paid-API path. |

Official material consulted included [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md), [Buffer publishing](https://buffer.com/publish), [Buffer overview](https://support.buffer.com/article/598-what-is-buffer-and-where-can-i-watch-a-demo), [Buffer analytics](https://support.buffer.com/article/955-using-buffer-analyze), [Qwen Code](https://github.com/QwenLM/qwen-code), [Qwen provider configuration](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/), [Cline](https://cline.bot/), [OpenRouter docs](https://openrouter.ai/docs), [Meta AI media generation](https://ai.meta.com/meta-ai/media-generation/), [Mureka quickstart](https://platform.mureka.ai/docs/en/quickstart.html), [Mureka instrumental generation](https://platform.mureka.ai/docs/api/operations/post-v1-instrumental-generate.html), [Stack Overflow AI Assist](https://stackoverflow.blog/2025/12/02/introducing-stack-overflow-ai-assist-a-tool-for-the-modern-developer/), [Enerpize marketing-services management](https://www.enerpize.com/marketing-services-management-software/), [AIPraktor](https://www.aipraktor.com/), and [SuperCool Marketing Studio](https://marketing.supercool.com/). Reference review does not imply endorsement, compatibility, or a complete audit of these products.

## 3. Feasible work implemented

### Product and reference-driven features

- Expanded Marketing Studio with four specialized kit types (SEO brief, CRO experiment, customer case study, referral), evidence/consent-aware review notes, Markdown export, three additional semantic diagrams (quadrant, flywheel, service blueprint), editable light palette tokens, 2× PNG export, and safer CTA color normalization/contrast plus HTML download. Existing saved assets remain editable. No upstream code or design assets were copied.
- Added a fully opt-in Firecrawl v2 scrape adapter for an operator-configured service. It has bounded responses/timeouts, no hosted default, and no silent fallback; the direct mode continues to use MarketingOS's DNS-pinned safe fetcher.
- Hardened SEO, content, campaign, competitor, and keyword API validation/persistence; added sanitized feed-headline matching to Market Intelligence.
- Kept live external publishing, ranking data, and unrelated ERP/commerce systems out of scope rather than presenting them as implemented.

### Self-hosted AI and media boundaries

- `src/lib/ai-provider.ts` defaults text generation to Ollama (`llama3.2:3b` by default) through non-streaming `/api/chat`. OpenRouter and Z.AI text require explicit configuration. There is no intended automatic paid-provider fallback.
- Chat, auto-reply drafts, diagram generation, grammar checks, humanization, video-plan scripts, agent runtime, and workforce text generation use the configured text adapter where wired.
- Added a server-side ComfyUI image adapter using a standard checkpoint workflow. It requires an operator-hosted ComfyUI server and checkpoint; no weights are bundled, it is not live-tested, and a configured local failure never falls back to hosted AI.
- Added a configurable ComfyUI API-workflow adapter for 3–10 second AI video clips and an OpenAI-compatible local TTS adapter. Operators must supply compatible workflows/services, models, licenses, and hardware. These paths have focused mocked tests but no live inference; generated video/audio is returned to the current session and not stored in the database. Local failures do not fall back to hosted services.
- Added browser-only social PNG and silent 12-second WebM text-card makers. They use no API/model but are templates—not AI-generated image art or video footage.
- Avatar generation and voice cloning are not implemented locally. Hosted Z.AI media routes require `ZAI_MEDIA_ENABLED=true`; video planning still only saves a script/storyboard draft unless a separate clip-render action is used.
- Optional Mureka music generation uses a hosted API and can incur charges. It is not required for local text generation.
- `docker-compose.local-ai.yml` keeps Ollama off the host-published ports and persists model files in a named volume. The overlay parses as YAML, but Docker Compose itself was unavailable for validation and no deployment was performed.
- Setup, resource/licensing caveats, provider selection, and limits are in [SELF-HOSTED-AI.md](SELF-HOSTED-AI.md).

### Correctness and safety remediation

- Unified `useAuth` with the Zustand-backed session state so education/HR views no longer throw because they relied on an unmounted, separate auth context; login/register results now retain the token in app state.
- Removed Next.js `ignoreBuildErrors`, so the production build cannot intentionally ignore TypeScript errors.
- Disabled the old `deploy.sh`: it hard-coded an unrelated GitHub repository and `main` push, staged all files, bypassed hooks, and used `prisma db push --accept-data-loss`. It now exits without changing files and points to the reviewed deployment docs.
- Marked stale sandbox-specific canonical/deployment/verification documents as superseded or historical; updated README/provider disclosures and corrected visible integration counts to 116.
- Earlier remediation in this work also addressed message ownership, company-scoped API checks, credential validation/storage limits, and other route/UI findings. A complete tenant-boundary review remains open.

## 4. Current capability and completeness matrix

| Area | Assessment |
|---|---|
| CRM, teams, campaigns/content, analytics, feeds/market intelligence | Substantial app/API implementation exists; the entire set has not received current end-to-end regression testing. |
| Marketing Studio kits/diagrams | Applicable reference-driven UI and assets implemented; not a substitute for a full browser/accessibility/design QA pass. |
| Integration catalog | **116 unique `toolNumber` entries**, not 120 and not 116 live connections. Gaps: 16, 17, 18, and 115. Mureka is #120. OAuth/provider sync must be assessed per integration. |
| AI text | Self-hosted path implemented in code as the default, but local inference, model quality, concurrency, privacy configuration, and performance have not been live-tested. |
| Image creation | Optional self-hosted ComfyUI checkpoint workflow is wired into the image route but not live-tested. Browser template PNG graphics also work without a model/API; they are not AI art. Hosted Z.AI is a separate opt-in path. |
| Video/avatar/speech generation | A custom ComfyUI API workflow can render 3–10 second AI clips; an OpenAI-compatible local TTS service can return speech. Neither model/service is bundled or live-tested, and outputs are session-only rather than persisted. Avatar/voice cloning is not implemented. Hosted Z.AI remains opt-in; configured local failure never falls back. |
| Music | Optional external Mureka integration; can incur charges. |
| Social media | Account/catalog UI exists, but connected publishing/sync is not implemented. Scheduling is not publishing. |
| Customer inbox | Internal messages only; no unified external social/messaging inbox. |
| SEO | Manual plans/checklists; no verified live ranking/traffic/backlink collection. |
| VoIP | Simulated; no verified telephony provider connection. |
| Education/HR/workforce | Views, APIs, and seeded data exist. A dedicated cross-tenant authorization and data-boundary review is still required. The “2,000 employees” are seeded workforce profiles, not 2,000 independent autonomous agents. |
| Production readiness | Not verified. No deployment, production build, live database migration, backup/restore, or rollback test has been completed in this audit. |

## 5. Security, reliability, and documentation findings

- **Browser token storage:** JWT bearer tokens are stored in `localStorage` (`mos_token`), which exposes them to successful XSS. No HttpOnly-cookie migration has been made.
- **Tenant isolation:** representative CRM/company checks have been reviewed and hardened, but education/workforce and all API routes have not undergone a complete authorization matrix or cross-tenant test. Do not treat partial scoping as proof of isolation.
- **Provider secrets:** third-party credentials are server-side and update validation/storage limits were added. Credential encryption still depends on correct production key management and backup of `CREDENTIAL_ENCRYPTION_KEY`.
- **Tests:** added focused Node smoke tests for ComfyUI image/video adapters and local TTS, and wired `npm test`/CI to run them as a blocking check. These mock adapter behavior, not actual models or a broad application/browser regression suite. The older `tests/database-runtime-build.sh` still calls a missing `.zscripts/database-runtime-build.sh`; other legacy runtime tests also point at missing `.zscripts` helpers.
- **Old docs/deploy path:** `docs/DEPLOYMENT-RUNBOOK.md` and `docs/FINAL-PRODUCTION-VERIFICATION-REPORT.md` described another sandbox snapshot. They are now explicitly marked deprecated/historical. The `deploy.sh` unsafe path has been disabled.
- **Dependency risk:** a previous `npm audit --omit=dev` reported 11 production advisories (1 critical, 6 high, 4 moderate). Re-run a current dependency audit and remediate before release; the earlier result is a warning, not a claim about the current post-install advisory database.
- **Tool catalog claims:** current UI/metadata now says 116 catalog entries, not live connections. Older historical logs may contain the former “120 tools” count.

## 6. Validation performed and blockers

| Check | Result |
|---|---|
| `npm run lint` | **Pass** after the current source edits. |
| `git diff --check` | **Pass** at the last check; rerun after any further edits. |
| Seed catalog static check | **Pass:** 116 unique identifiers; gaps 16, 17, 18, 115; Mureka #120. |
| YAML syntax | Production/local-AI Compose files and the CI workflow parse as YAML via `js-yaml`. This is not `docker compose config` or GitHub Actions validation. |
| `docker compose` | **Not run:** Docker is unavailable in the workspace. |
| `npm run typecheck` | **Blocked:** `@prisma/client` has no generated `PrismaClient` export. |
| `npx prisma generate` | **Failed earlier:** Prisma engine checksum download disconnected at `binaries.prisma.sh` TLS. Do not repeat unchanged without a working engine/network source. |
| Node runtime | Workspace is Node `v22.22.3`, below the package/Docker requirement `>=22.23.2 <23.0.0`. |
| `npm test` | **Pass:** seven focused mock tests cover ComfyUI image/video submit-poll-download and no-server behavior plus local TTS configuration/request validation. These do not replace live inference or app-wide/browser tests; legacy shell tests still refer to missing `.zscripts`. |
| Production build/deploy/live AI | **Not performed / not verified.** No Ollama or ComfyUI server/checkpoint, hosted key, browser-recording test, production build, or deployment was available. |

Removing `ignoreBuildErrors` makes the production build fail closed on type errors. A typecheck and build are therefore still required in an environment with the generated Prisma client and engine available.

## 7. Next steps, in order

1. Run in Node 22.23.2+ with working Prisma engine access: `bunx prisma generate`, `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build`; fix every error. Expand the focused smoke test into API, authorization, and browser regression coverage.
2. Replace or repair the stale `.zscripts`-based tests; verify all CI workflows and Docker build/deploy paths against the current branch/workflow settings.
3. Complete an authorization matrix for every API route, especially education, HR, workforce, messages, files/assets, and integration credentials. Add cross-company/institution negative tests.
4. Plan migration from localStorage bearer tokens to secure HttpOnly cookies (or document and mitigate the accepted XSS risk with a tested CSP and comprehensive output/input controls).
5. Validate the actual production Compose file on the target host, secret ownership/rotation, mounted SQLite persistence, backup/restore, schema-sync, health check, and rollback. Do not treat `docker-compose.prod.yml` as proof of live configuration.
6. Run Ollama with the intended model on representative hardware; test latency, context limits, concurrent requests, failure behavior, data handling, and model licensing. Confirm there is no hidden hosted fallback.
7. Install and license a compatible ComfyUI video model/workflow and an OpenAI-compatible TTS service on suitable private hardware; exercise each through the configured adapters, validate cost/latency/output persistence and consent requirements, and decide whether durable media storage and asynchronous job processing are needed. Implement real social publishing/inbox/SEO integrations only with verified provider access.
8. Re-run dependency security review, audit the 116-entry catalog for provider-specific OAuth/API status and licensing, and complete browser/accessibility testing for the new kits and diagrams.
