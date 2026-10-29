# Testing, deployment and rollback status

## Local validation (2026-10-29)

The branch was validated in a sandbox with Node 22.22.3 and Bun 1.3.4 via `npx`; this is below the repository's specified Node 22.23.2 minimum, so reproduce on the pinned runtime before release. Network/provider behavior was mocked, and tests used disposable SQLite databases. No real sends, publication, paid generation or deployment were attempted.

| Check | Local result |
| --- | --- |
| `npx --yes --package=bun@1.3.4 -c 'npm test'` | Passed: 66 Bun tests across isolated files and 23 Node tests. |
| `npm run lint` / `npm run typecheck` | Passed. |
| `npm run build` with disposable `DATABASE_URL` and an ephemeral `JWT_SECRET` | Passed; generated standalone output. Build success does not prove runtime provider availability or production security. |
| `npm run security:secrets` | Passed working-tree pattern scan. One historical match in commit `c8c12c9ce3c9` was identified as a synthetic test fixture; scanning cannot establish the absence of all secrets. |
| `npx --yes bun@1.3.4 audit` | No advisories reported at check time; dependency and registry results change. |
| `prisma validate` | Passed using sandbox binary overrides; those overrides are **not usable for database migration**. |
| SetupBot additive SQL | Disposable SQLite test passed. It remains unapplied and is not a full migration baseline. |

There was no FFmpeg, Docker or browser-based end-to-end test in this environment; no live Meta/social, messaging, speech, AI model, image or video provider check. CI results on the pull request and production runtime tests are separate from these local checks.

## Release blockers and owner prerequisites

1. Complete the security and functional audit of remaining legacy APIs, UI and integrations; review this intentionally breaking fail-closed behavior with affected users.
2. Choose and explicitly authorize a target; supply server-side secrets through a secure channel and establish HTTPS, trusted proxy headers, access controls and query-string redaction. Do not send secrets in chat.
3. Verify actual database schema, backup plus separately stored encryption key, then rehearse restore and an approved additive migration on an isolated copy. `prisma/changes/20261029_setupbot_additive.sql` is only a proposed five-table change; it is not a Prisma migration baseline. `scripts/db-sync-schema.sh` requires an integrity-checked distinct backup for an existing DB and refuses detected destructive diffs; it does not replace review and restore rehearsal. Do not use a reset or `--accept-data-loss`.
4. Re-run frozen dependency install, lint, typecheck, full tests, build, secret/dependency checks, browser/security tests and provider sandbox checks on the pinned production runtime. Validate permissions and current pricing; obtain explicit approval before any send, publication or charge.
5. Establish monitoring, durable jobs, approval/budget controls, consent/suppression and incident ownership before enabling external actions.

## Rollback plan (not rehearsed)

Record the previously deployed image/commit, configuration and key version. In an approved maintenance window, stop external workers/sends and route traffic away; restore the previous application version. If schema or data restoration is needed, use the owner-approved, integrity-checked backup and tested recovery procedure, preserving the corresponding encryption key; validate data and health before reopening traffic. Database restoration may discard writes since the snapshot and requires explicit owner approval. Do not delete live data or restore over it as an automatic reaction to a failed deployment.

**Deployed location: none.** No production host was supplied or changed. Outstanding implementation and security work are listed in [REPOSITORY-AUDIT-2026-10-29.md](REPOSITORY-AUDIT-2026-10-29.md) and [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md).
