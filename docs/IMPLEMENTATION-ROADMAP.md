# MarketingOS implementation roadmap

**Status: proposed, not completed.** Keep disabled operations fail-closed until the corresponding release gate is independently verified. This roadmap is not authorization to deploy, send, publish, spend money, or modify production data.

## P0 — safety and recovery before any production rollout

1. Inventory every remaining route, view, background task and provider path for authenticated server-side role checks, tenant ownership and credential handling. Complete the source-backed A–H audit rather than extrapolating from the routes touched here. Add cross-tenant and low-privilege tests for each domain.
2. Establish a reviewed, additive migration baseline for the actual database. Compare against production schema without changing it; verify off-host backup, encryption key custody and restore to an isolated copy. The proposed SetupBot SQL is not a complete migration.
3. Address browser bearer-token/XSS exposure, centralized rate limits, secret/query redaction and secure proxy configuration. Review historical OTP-shaped rows with the owner before any retention/deletion action.
4. Rehearse client provisioning as an atomic transaction; establish system-admin and key-rotation procedures. Verify restore, rollback, monitoring and incident ownership.

## P1 — durable, approved operations

- **Jobs and workflow:** design a durable queue with leases, retries/backoff, deduplication, run history, crash recovery, pause-all and per-tenant concurrency. Preserve local workflow transaction/idempotency tests; add worker restart and replay tests.
- **Publishing and outreach:** implement official provider adapters and webhooks, token refresh, explicit approvals, consent/suppression, content/media validation, remote identifiers and delivery/publish state reconciliation. Failure must not become success. Add sandbox tests, rate-limit tests and tenant isolation.
- **Media and assets:** implement securely owned asset records, access controls and consent-to-asset/channel binding; immutable evidence and revocation; durable generation jobs; resource limits, retention and verified files. Keep lip-sync/persona render disabled until these gates pass.
- **Spending:** enforce durable per-tenant approval and budget limits, expiry, audit, idempotency, rate/concurrency limits and post-call accounting for hosted providers; per-request checkboxes alone are insufficient.

## P2 — actual marketing capabilities

- Campaign planning with verifiable creative assets, approval history, calendar execution and pause controls; distinguish planned from published.
- SEO crawls and keyword work through bounded, SSRF-safe jobs; test robots/policy, throttling, data provenance and resource consumption.
- Opt-in email/WhatsApp/CRM automations with unsubscribe/STOP, evidence of consent and separate accepted/sent/delivered/bounced/failed states.
- Ads connectors with explicit account permissions, budget ceilings and human approval before creation or spend.
- Provider-backed analytics with provenance, timestamps, attribution definitions, reconciliation and missing-data states instead of estimates presented as facts.
- AI workforce with bounded responsibilities, scoped knowledge and memory, tool permissions, human review, concurrency/cost limits and transparent activity logs. Seeded agents do not count as operating staff.

## P3 — release validation

Provide responsive accessible UI over real tenant data; browser and multi-user tests; queue/provider fault injection; restore and load tests; reproducible builds; security review and owner sign-off. Deploy only to an explicitly authorized target, verify health and features without unauthorized external side effects, and maintain a tested rollback. Capture actual provider terms and permissions at the time of integration because prices and policies change.

The branch's locally tested subset and outstanding limitations are documented in [REPOSITORY-AUDIT-2026-10-29.md](REPOSITORY-AUDIT-2026-10-29.md) and [TESTING-AND-DEPLOYMENT.md](TESTING-AND-DEPLOYMENT.md).
