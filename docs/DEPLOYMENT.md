# MarketingOS — deployment and database operations

How a commit reaches `marketing.alolabs.net`, and how the database is kept alive
while it does. This is a repository-level reference; the VPS configuration is
outside Git and must be checked against the running host before deployment.

> **Safety note:** the former `deploy.sh` one-click script is intentionally
> disabled. It targeted an unrelated hard-coded GitHub repository/`main` branch
> and used `prisma db push --accept-data-loss`. Use the reviewed CI/deploy
> workflow and verify the live host configuration instead.

---

## 0. Reverse proxy, TLS and process management

The application listens on plain HTTP at `127.0.0.1:3000`. Reviewed, checked-in
configurations live in `deploy/`:

- `deploy/caddy/Caddyfile` — TLS termination for the Compose deployment
- `deploy/nginx/marketingos.conf` — Nginx + certbot
- `deploy/pm2/ecosystem.config.cjs` — bare-metal PM2, single instance (SQLite)

See [DEPLOYMENT-REVERSE-PROXY.md](DEPLOYMENT-REVERSE-PROXY.md). The repository
root `Caddyfile` is the sandbox preview proxy and must not be deployed.

---

## 1. The pipeline

```
push to main
   ├─► CI ......................... lint · typecheck · secret scan · production build
   └─► Docker Build & Push ........ builds the image, tags it with the commit SHA,
                                    pushes to Docker Hub + GHCR
                                         │
                                         ▼ (only on success)
                              Deploy to VPS
                                 1. resolve target commit
                                 2. REQUIRE CI green for that exact commit
                                 3. verify deployment secrets exist
                                 4. SSH, save the current image for rollback
                                 5. pull the image for this commit
                                 6. PREFLIGHT — prove the database persists
                                 7. verified, integrity-checked backup
                                 8. safe schema sync (no --accept-data-loss)
                                 9. rolling restart on the pulled image
                                10. health check: DB round-trip + config + SHA match
                                    └─ on failure: roll back to the saved image
```

`Deploy to VPS` triggers on `workflow_run` of `Docker Build & Push`, **not** on
`push`. Both previously triggered on `push: main` and ran in parallel, so the
deploy tried to pull an image tag that did not exist yet.

`needs:` cannot cross workflows, so the image workflow completing successfully
is the trigger, and the CI result for the same commit is checked explicitly in
step 2.

---

## 2. The database

**Provider:** SQLite (`prisma/schema.prisma`). The database is a plain file.

| | |
|---|---|
| Container path | `/app/db/custom.db` |
| Host path | `/opt/aismh/db/custom.db` |
| Mount | `./db:/app/db` |
| Backups | `/opt/aismh/backups/` (mounted at `/app/backups`) |
| `DATABASE_URL` | `file:/app/db/custom.db` — **absolute** |

`db/custom.db` is the project's own convention: `deploy.sh` uses
`file:./db/custom.db`, and `tests/database-runtime-build.sh` asserts an
absolute `file:` URL ending in `db/custom.db`.

### Why the mount is not optional

Without `./db:/app/db` the database lives in the container's writable layer and
**is destroyed every time the image is replaced** — that is, on every deploy.

The compose file that decides this lives at `/opt/aismh/docker-compose.yml`,
on the server, outside version control, so it cannot be reviewed in a pull
request. `scripts/preflight-persistence.sh` therefore verifies it at deploy
time by writing a probe file in one container and confirming it is visible in
the next. If persistence cannot be proven the deploy stops **before** the
backup and schema steps, with nothing touched.

Use `docker-compose.prod.yml` in the repository as the reviewed reference and
reconcile the server file against it.

### Absolute paths only

A relative `DATABASE_URL` resolves against each process's working directory, so
the app, `prisma` and the backup script can each end up on a *different* file —
you back up one database and migrate another. The preflight rejects relative
paths.

---

## 3. Schema changes

There is **no `prisma/migrations/` directory**. This project uses `db push`
everywhere (`deploy.sh`, `package.json`, the runbook), so the old
`prisma migrate deploy` step could never have succeeded.

`scripts/db-sync-schema.sh`:

1. refuses to run unless a verified backup exists (except on a genuinely empty
   first deploy),
2. computes and prints the pending diff with `prisma migrate diff`,
3. **aborts on destructive statements** — `DROP TABLE`, `DROP COLUMN`,
4. applies with `prisma db push`, deliberately **without**
   `--accept-data-loss`,
5. runs `PRAGMA integrity_check` afterwards.

A destructive change is a deliberate, reviewed, manual operation. It is never
applied automatically.

### Moving to migrations later

Generate a baseline from the current schema, then mark it applied on the
existing production database so nothing is replayed:

```bash
mkdir -p prisma/migrations/0_init
bunx prisma migrate diff \
  --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# On production, AFTER a verified backup:
bunx prisma migrate resolve --applied 0_init
```

Then swap step 8 for `prisma migrate deploy`.

---

## 4. Backup and restore

### Backup — `scripts/db-backup.sh`

Runs automatically before every schema change, and can be run by hand.

* `sqlite3 .backup` (online backup API) — correct against a live, WAL-mode
  database. A plain `cp` can capture a torn page; it is only used as a fallback
  and warns loudly.
* Verifies the result: exists, readable, non-zero, `PRAGMA integrity_check = ok`,
  and reports the table count.
* Timestamped `custom-YYYYMMDDTHHMMSSZ.db`, `chmod 600`.
* Keeps the newest 14. Never deletes the only backup.
* Missing database is a clean no-op (first deploy), not a failure.
* **Non-zero exit blocks the schema change.**

```bash
docker compose run --rm --no-deps --entrypoint bash app scripts/db-backup.sh
```

### Restore — `scripts/db-restore.sh`

```bash
docker compose run --rm --no-deps --entrypoint bash app scripts/db-restore.sh --list
docker compose stop app
docker compose run --rm --no-deps --entrypoint bash app \
  scripts/db-restore.sh /app/backups/custom-20260101T120000Z.db
docker compose up -d app
curl -fsS https://marketing.alolabs.net/api/health | jq .
```

The backup is integrity-checked **before** the live database is touched, and
the current database is snapshotted to `pre-restore-*.db` first, so a restore
is itself undoable. It refuses to overwrite a database that a process still has
open unless `--force` is given.

---

## 5. Health

`GET /api/health` returns `200` when healthy, `503` when degraded:

```json
{
  "status": "ok",
  "commit": "3c1c682...",
  "uptimeSeconds": 42,
  "node": "v22.23.2",
  "checks": {
    "database": { "ok": true, "latencyMs": 3 },
    "config":   { "ok": true }
  }
}
```

The deploy asserts all three: a real database round-trip, required config
present, and **`commit` equal to the commit being deployed** — which is what
catches a container that silently never restarted. A bare `200` is not treated
as proof of anything.

No secret values, connection strings or stack traces are exposed; the database
check reports only an error *class*.

---

## Dashboard release control

MarketingOS includes a company-owner/super-admin-only **Deployments & Hosting** view. It reads recent GitHub Actions runs and can queue the repository's `deploy.yml` using `workflow_dispatch`; dispatch accepts only `latest` or a commit SHA and requires an explicit human confirmation. The privileged SSH deployment remains in GitHub Actions, never in browser code. The workflow keeps its CI, verified backup, safe schema sync, health-check and rollback gates.

Configure these values only in the server-side environment (never in `NEXT_PUBLIC_*` variables):

| Variable | Purpose |
|---|---|
| `DEPLOY_GITHUB_REPOSITORY` | `owner/repository` containing the deployment workflow |
| `DEPLOY_GITHUB_TOKEN` | Least-privilege GitHub token with Actions read/write access to that repository |
| `DEPLOY_GITHUB_WORKFLOW` | Optional workflow filename; defaults to `deploy.yml` |
| `DEPLOY_GITHUB_BRANCH` | Optional workflow dispatch ref; defaults to `main` |

Then restart MarketingOS and sign in as an admin to load the view. The dashboard does not provision the supplied Ubuntu host, reserve ports, edit Nginx, change Cloudflare DNS, or issue TLS certificates. Those actions need a reviewed host bootstrap process and operator-controlled credentials. The UI presents the provided host information and copies a project brief, but does not claim the host was reached or modified. Additional deployment providers can be implemented behind an adapter; only GitHub Actions is currently wired.

## 6. Required configuration

### GitHub Actions secrets

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | VPS hostname |
| `DEPLOY_SSH_KEY` | private key for the deploy user |
| `DEPLOY_USER` | optional, defaults to `deploy` |
| `DEPLOY_PORT` | optional, defaults to `22` |
| `DOCKERHUB_USERNAME` | registry account |
| `DOCKERHUB_TOKEN` | registry token |
| `SLACK_WEBHOOK_URL` | optional notification |

Variables: `DEPLOY_URL`, `DOCKER_IMAGE_NAME`, `HEALTH_PATH`.

The `Check deployment configuration` job runs first and names anything missing.
If `DEPLOY_HOST` / `DEPLOY_SSH_KEY` are absent, an **automatic** deploy
(triggered by a merge to `main`) is *skipped* with a warning and step-by-step
setup instructions in the run summary — the image is still built and pushed,
and nothing on the server is touched. A **manual** `workflow_dispatch` with
missing secrets fails hard, because a person explicitly asked for a deploy.

To enable deploys: *Settings → Secrets and variables → Actions → New repository
secret* and add `DEPLOY_HOST` and `DEPLOY_SSH_KEY` (full private key including
the `BEGIN`/`END` lines). The next merge to `main` — or a re-run of the latest
"Deploy to VPS" run — will deploy.

### Server environment

`/opt/aismh/.env`, root-owned, `chmod 600`. See `.env.example`.
`JWT_SECRET` uses `${JWT_SECRET:?}` in compose so the stack refuses to start
rather than booting with an empty signing key.

---

## 7. Failure handling

Each stage fails distinctly and stops the sequence:

| Stage | On failure |
|---|---|
| CI gate | Deploy never starts |
| Image build | `workflow_run` guard blocks the deploy |
| Missing secrets | Automatic deploy skipped with instructions (manual deploy fails), names what is absent |
| SSH / host key | Fails at `ssh-keyscan` |
| **Persistence preflight** | **Stops before backup — nothing touched** |
| Backup | Stops before the schema change |
| Schema sync | Stops; backup path reported for restore |
| Startup | Health check fails |
| Health check | Rollback to the saved previous image |

Rollback uses the image tag captured *before* the pull, and re-runs on the
pulled image rather than rebuilding from whatever source is on the VPS.

---

## 8. First deployment checklist

1. Reconcile `/opt/aismh/docker-compose.yml` with `docker-compose.prod.yml` —
   above all the `./db:/app/db` mount. **Back up the existing file first.**
2. `mkdir -p /opt/aismh/db /opt/aismh/backups && chown -R 1001:1001 /opt/aismh/db /opt/aismh/backups`
   (the container runs as uid 1001).
3. Create `/opt/aismh/.env` from `.env.example`; set `JWT_SECRET` and
   `DATABASE_URL=file:/app/db/custom.db`.
4. Install `sqlite3` on the host if you want host-side backups; the image
   already ships it.
5. Confirm the GitHub secrets above.
6. Merge to `main` and watch the three workflows in order.
7. `curl -fsS https://marketing.alolabs.net/api/health | jq .` and confirm
   `commit` matches.

**Never** run `docker compose down -v` — it deletes volumes.
