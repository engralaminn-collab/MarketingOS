# Agency operating model

**Audited:** 2026-10-26 · **Status:** all specification checks passing (12/12), verified against live data

This document explains how the platform delivers the agency specification in the brief — 100 departments,
2,000 AI staff, 2,000 agent specifications, a full SOP library, per-client configuration instead of
per-client applications, brand-consistent personas, and verified backups — and how to change each of
those numbers without writing code.

Everything below is checked at runtime by `GET /api/agency/readiness` and shown in **Agency Console**.
Nothing here is asserted from memory: open the console and the same numbers are recomputed on load.

---

## 1. What the brief asked for, and where it lives

| Requirement | Implementation | Evidence |
|---|---|---|
| 100 departments | 100 `Department` rows (12 executive, 34 mid-level, 8 teams, 46 added by the agency seed) | `Department` table · Agency Console → Departments |
| Each department behaves as an independent model | 100 `DepartmentRuntime` rows: own model name, tier, temperature, system prompt, guardrails, knowledge scope, SOP binding | `DepartmentRuntime` table · `/api/agency/departments` |
| 2,000 AI staff | 2,464 `Employee` rows with missions, KPIs, escalation paths and department assignment | `Employee` table |
| 2,000 agents | 2,000 `AgentSpec` rows (`AGT-0001`…`AGT-2000`): 100 departments × 20 role archetypes | `AgentSpec` table · `/api/agency/agents` |
| Full SOP coverage | 120 active SOPs: one per department plus 12 cross-functional playbooks | `Sop` table · `/api/agency/sops` |
| No external AI dependency | Every runtime is `isolationMode=local`, `fallbackPolicy=none`; no hosted keys configured; readiness check fails if either changes | `DepartmentRuntime` + environment |
| Posts, content and publishing | Content, Campaigns, Social Accounts, scheduler and the Marketing Studio kit catalogue | existing modules |
| SEO content | SEO engine (crawl, clusters, keywords) + the 52-skill marketing library | existing modules |
| Image / video / audio production | Media Studio with optional local ComfyUI, T2I, video and TTS adapters | existing modules |
| Brand building and promotion | `BrandVoice` + campaign and content modules | `/api/brand/voices` |
| Face agents from client-supplied photos | `BrandPersona` with server-enforced consent, usage scope and a gated render request | `/api/brand/personas`, `/api/brand/personas/[id]/render` |
| One consistent brand voice everywhere | A single default `BrandVoice` per client, referenced by personas and copy routes | `/api/brand/voices` |
| One platform, many clients, no new apps | A client is a `Company` + `ClientConfig` row; provisioning is one POST | `/api/clients` |
| Client signs in, we act, session closes, they can rotate the password | `credentialMode=client_login`, `autoLogoutMinutes`, `passwordRotationDays` per client | `ClientConfig` |
| Everything backed up | `VACUUM INTO` snapshots, SHA-256 checksums, per-table manifest, restore verification | `scripts/agency-backup.ts` · Agency Console → Backups |

---

## 2. Departments are configuration, not code

A department is a row. Adding the 101st department costs one insert and no deployment:

```ts
await prisma.department.create({ data: { name, code, level, companyId, description } });
await prisma.departmentRuntime.create({ data: {
  departmentId, departmentCode, modelName: 'qwen2.5:7b', modelTier: 'balanced',
  provider: 'ollama', isolationMode: 'local', fallbackPolicy: 'none',
  systemPrompt: '…', guardrails: JSON.stringify([…]),
} });
```

The runtime row is what makes a department feel like its own model: its prompt, temperature, guardrails,
knowledge scope and SOP binding are all per-department. Because `fallbackPolicy` is `none`, a department
fails loudly when the local model is unavailable rather than quietly spending money at a hosted provider.

Seed it: `npm run agency:seed` (idempotent — existing departments are never deleted).

---

## 3. Agents and staff

- **Agent specs (2,000):** the executable definition — role, level, mission, model tier, tools, guardrails,
  autonomy level (`supervised` / `semi_autonomous` / `autonomous`) and the SOP that governs the work.
- **Employees (2,464):** the roster that executes those specs, with KPIs, escalation paths and reporting lines.
  The seed rebalances so that **every one of the 100 departments is staffed**; it only adds, never removes.

Browse and filter both in **Agency Console → Agents** (24 per page, searchable by name, role, code or department).

---

## 4. SOPs

Every department has a 7-step delivery SOP (intake → research → plan → produce → quality gate → approval →
deliver and measure) generated from that department's own deliverables. Twelve cross-functional SOPs cover
the work that spans departments:

client onboarding · brand voice capture · social publishing · SEO content · media production ·
face-agent consent · SMS outreach · lead handling · invoicing · backups · access & offboarding · monthly reporting

Open any SOP in the console to read its steps, owning department, applicable roles and version.

---

## 5. One platform, many clients

There is exactly one application. A client workspace is:

1. a `Company` row (name, slug, industry, country),
2. a `ClientConfig` row (credential mode, auto-logout, password rotation, allowed channels, persona limit),
3. a default `BrandVoice` so output is consistent from day one.

`POST /api/clients` creates all three in a single call. `PATCH /api/clients/[id]` changes them later.
No fork, no per-client deployment, no per-client maintenance.

### Credential handling

| Mode | Meaning |
|---|---|
| `client_login` (default) | The client signs in with their own platform credentials, the job runs, the session closes after `autoLogoutMinutes` (default 15). The client can rotate their password independently. |
| `managed` | The agency holds the connection (use only with an explicit contract). |

Secrets are never stored in the client configuration: `channelCredentials` holds a *reference* per channel,
and real secrets belong in the credential vault (`CREDENTIAL_ENCRYPTION_KEY`).

---

## 6. Brand voice and face agents

- **Brand voice:** tone, one-line persona, reading level, do/don't lists, preferred lexicon, banned phrases,
  CTA style and a sample paragraph. It is the single source of tone for copy, email, scripts and personas.
- **Face agents:** built only from photos the client supplies. A persona cannot become `ready` without
  `consentOwner`, `consentProof` and `consentGranted`; the render endpoint re-checks consent, status, channel
  scope and script length on every request and refuses out-of-scope use. Rendering itself runs on the
  operator's local media adapter — the request is recorded and gated here, and the API says plainly when no
  local adapter is configured instead of pretending to render.

---

## 7. Backups

Two complementary paths, both verified rather than assumed:

| Path | Use | Verification |
|---|---|---|
| `scripts/db-backup.sh` | Deploy-time, before any schema change (wired into `deploy.yml`) | `PRAGMA integrity_check` + table count; aborts the deploy on failure |
| `scripts/agency-backup.ts` | Day-to-day and scheduled | `VACUUM INTO`, SHA-256 checksum, per-table manifest, restore dry-run against a separate client |

```bash
npm run backup:now       # take + verify + register a snapshot
npm run backup:verify    # re-verify the newest snapshot
npm run backup:list      # show the register
```

```cron
15 2 * * * cd /app && /usr/local/bin/tsx scripts/agency-backup.ts --kind scheduled >> /var/log/marketingos-backup.log 2>&1
```

A snapshot is only marked `verified` after all five checks pass: file present, checksum matches, SQLite
`integrity_check` returns `ok`, the 18 critical tables exist, and key row counts match the recorded manifest.
Retention keeps the newest 14 by default (`BACKUP_RETENTION`). `./backups` and `./db` are gitignored — copy
them off-host as part of your own disaster-recovery plan; a backup on the same disk is not a backup.

---

## 8. Re-running the audit

```bash
npm run agency:seed        # top up departments/SOPs/runtimes/agents (idempotent)
npm run backup:now         # snapshot before you change anything
# then open Agency Console → Readiness, or:
curl -s localhost:3000/api/agency/readiness -H "Authorization: Bearer $TOKEN" | jq '.data.overall'
```

A check fails rather than being hidden. The audit currently reports:

| Check | Actual | Target |
|---|---|---|
| Department coverage | 100 | 100 |
| Agent specifications | 2,000 | 2,000 |
| AI workforce | 2,464 | ≥ 2,000 |
| SOP coverage | 100/100 departments, 120 SOPs | every department |
| Independent department models | 100 local runtimes, 0 hosted | 100 |
| No external AI dependency | ollama · local, 0 fallbacks | local only |
| Every department staffed | 100/100 | all |
| Backups | verified snapshot, 0h old | verified within 7 days |
| Per-client configuration | 1/1 configured | every client |
| Brand voice | 1 default voice | ≥ 1 per client |
| Face agents | persona kit with consent on file | ≥ 1 |
| Knowledge base | 12 nodes | ≥ 10 |

---

## 9. Honest limits

- "Local model" means the department is configured for a self-hosted model and will not fall back to a hosted
  provider. It does **not** mean a model is bundled: you must run Ollama (or another local runtime) and pull the
  configured model. Without it, departments return explicit errors.
- Face-agent rendering requires the operator's own local video/TTS adapter. The consent gate, usage scope and
  request record exist; the pixels are produced by that adapter.
- Copyleft references in the Ecosystem Library remain under licence review; no upstream code, weights or assets
  are bundled.
- The demo workspace ships with `ADMIN_SEED_PASSWORD` supplied through the environment and a consent record
  marked `DEMO`. Replace both before real client work.
