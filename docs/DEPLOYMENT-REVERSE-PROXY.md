# TLS termination, reverse proxy and PM2 (bare metal)

The application itself only speaks plain HTTP on `127.0.0.1:3000`. Something in
front of it must terminate TLS, apply edge rate limits, and forward the real
client IP — otherwise `/api/health` is reachable over the public internet, the
login rate limiter keys on the proxy's address, and audit-log IPs are useless.

Two reviewed options are checked in:

| Runtime | File | Certificate |
|---|---|---|
| Docker Compose (`docker-compose.prod.yml`) | `deploy/caddy/Caddyfile` | Caddy, automatic ACME |
| Nginx + PM2 on the host | `deploy/nginx/marketingos.conf` + `deploy/pm2/ecosystem.config.cjs` | certbot |

> The `Caddyfile` in the repository **root is not for production**. It is the
> sandbox preview proxy: it forwards to any port named in an `XTransformPort`
> query parameter. Deploying it publishes an open proxy. Use
> `deploy/caddy/Caddyfile`.

---

## 1. Caddy (recommended with Compose)

```bash
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo editor /etc/caddy/Caddyfile          # set the hostname + ACME email
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://<your-host>/api/health | jq .
```

Caddy obtains and renews certificates on its own. Keep
`NEXT_PUBLIC_SITE_URL` equal to `https://<your-host>` so metadata, robots.txt
and sitemap.xml all advertise the same origin.

## 2. Nginx (host process, no Docker)

```bash
# 1. Build
bun install --frozen-lockfile
bunx prisma generate
bun run build                     # .next/standalone + static assets copied in

# 2. Database (absolute path, outside the build tree)
export DATABASE_URL="file:/var/lib/marketingos/db/custom.db"
bunx prisma db push --skip-generate
bash scripts/db-backup.sh

# 3. Process manager
sudo mkdir -p /var/lib/marketingos /etc/marketingos /var/log/marketingos
sudo cp deploy/pm2/ecosystem.config.cjs /etc/marketingos/
sudo cp .env /etc/marketingos/marketingos.env   # chmod 600, root-owned
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save && pm2 startup

# 4. Proxy
sudo cp deploy/nginx/marketingos.conf /etc/nginx/sites-available/marketingos
sudo ln -s /etc/nginx/sites-available/marketingos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <your-host>

# 5. Prove it
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://<your-host>/api/health
```

### PM2 notes

- **One instance only.** `ecosystem.config.cjs` is fork-mode with
  `instances: 1` on purpose: SQLite has a single writer, and cluster mode
  produces `SQLITE_BUSY` under concurrent writes.
- Secrets are never stored in the PM2 file. Use the environment or a
  0600 env file (`env_file` in the config) owned by root.
- `max_memory_restart: 1G` plus `pm2 logs marketingos` is the minimum
  monitoring for a host deployment. Pair it with the external uptime check
  below.

## 3. Health, monitoring and alerting

`/api/health` returns `200` only when the database round-trips **and**
`DATABASE_URL` + `JWT_SECRET` are present; otherwise `503` with a `checks`
object. It also reports `commit`, so an alert tells you exactly which build is
unhealthy.

```bash
# systemd timer / cron every minute
*/1 * * * * curl -fsS -m 5 https://<your-host>/api/health >/dev/null || \
  logger -t marketingos "health check failed"
```

Minimum production monitoring checklist:

1. `/api/health` polled externally every minute, alerting on non-200.
2. Disk-usage alert on the volume holding `db/` and `backups/` (a full disk is
   a write outage for SQLite).
3. `scripts/db-backup.sh` on a timer, plus `npm run backup:verify` after each
   run — the Agency Console shows the same verdict from live data.
4. Log shipping for the reverse proxy and the Node process; both are plain
   stdout/files, no agent is bundled.

## 4. Rollback

```bash
# Docker
docker compose pull && docker compose up -d          # previous tag pinned in AISMH_IMAGE
# PM2
git checkout <previous-release-tag> && bun run build && pm2 reload marketingos
# Database
bash scripts/db-restore.sh backups/<verified-snapshot>.db
```

Restore only a snapshot whose checksum verified (`npm run backup:verify`), and
stop the app first — restoring under a live process corrupts the file.
