#!/usr/bin/env bash
#
# MarketingOS — deployment preflight: prove the database survives container
# replacement BEFORE anything destructive happens.
#
# This is the guard that makes an automated deploy safe. schema.prisma uses
# SQLite, so the database is a plain file. If that file is inside the
# container's writable layer rather than on a mounted volume, every deploy
# silently destroys it. The compose file that decides this lives on the server
# and is not in version control, so it cannot be reviewed in a pull request.
#
# Run this on the VPS, from the compose project directory, before the backup
# and schema steps. Exits non-zero — halting the deploy — if persistence
# cannot be proven.
#
#   COMPOSE_FILE   default: docker-compose.yml
#   SERVICE        default: app
#   EXPECT_DB_DIR  default: /app/db      (container-side database directory)
#
set -euo pipefail

log()  { printf '   %s\n' "$*" >&2; }
ok()   { printf '✅ %s\n' "$*" >&2; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SERVICE="${SERVICE:-app}"
EXPECT_DB_DIR="${EXPECT_DB_DIR:-/app/db}"

[ -f "${COMPOSE_FILE}" ] || fail "Compose file not found: ${COMPOSE_FILE} (run from the compose project directory)"

command -v docker >/dev/null 2>&1 || fail "docker is not available on this host"

log "Inspecting ${COMPOSE_FILE} service '${SERVICE}' ..."

# ── 1. DATABASE_URL must be an absolute file: path ─────────────────────────
DB_URL="$(docker compose -f "${COMPOSE_FILE}" config 2>/dev/null \
  | awk -v svc="${SERVICE}:" '
      $0 ~ "^  "svc"$" {inservice=1}
      inservice && /DATABASE_URL:/ {print $2; exit}
    ' | tr -d '"'"'"'' || true)"

[ -n "${DB_URL}" ] || fail "DATABASE_URL is not set for service '${SERVICE}' in ${COMPOSE_FILE}.
       The application cannot reach a database, and a schema sync would target
       the wrong file. Add it, pointing inside the mounted volume."

case "${DB_URL}" in
  file:/*) ;;
  file:*)  fail "DATABASE_URL is a RELATIVE path: ${DB_URL}
       It resolves against each process's working directory, so the app,
       prisma and the backup script can each end up on a different file.
       Use an absolute path such as file:${EXPECT_DB_DIR}/custom.db" ;;
  *)       fail "DATABASE_URL is not a SQLite file: URL: ${DB_URL}" ;;
esac

DB_PATH="${DB_URL#file:}"
DB_DIR="$(dirname "${DB_PATH}")"
log "Container database path: ${DB_PATH}"

# ── 2. That directory must be a mounted volume, not the container layer ────
MOUNT_MATCH="$(docker compose -f "${COMPOSE_FILE}" config --format json 2>/dev/null \
  | tr ',' '\n' | grep -F "${DB_DIR}" || true)"

if [ -z "${MOUNT_MATCH}" ]; then
  fail "No volume mount covers ${DB_DIR} in ${COMPOSE_FILE}.

       The SQLite database therefore lives in the container's writable layer
       and WILL BE DESTROYED the next time the image is replaced — that is,
       on this deploy.

       Add to the '${SERVICE}' service, then re-run:

           volumes:
             - ./db:${EXPECT_DB_DIR}
             - ./backups:/app/backups

       See docker-compose.prod.yml in the repository for the reviewed
       reference configuration.

       Deployment halted. No data was touched."
fi
ok "A volume mount covers ${DB_DIR}"

# ── 3. Prove it end to end: write through the mount, replace the container,
#       and confirm the file is still there. This catches a mount that is
#       declared but points somewhere wrong.
log "Verifying persistence across container replacement ..."
PROBE=".persistence-probe-$(date -u +%s)"

if docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
     --entrypoint sh "${SERVICE}" -c "touch '${DB_DIR}/${PROBE}'" >/dev/null 2>&1; then

  if docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
       --entrypoint sh "${SERVICE}" -c "test -f '${DB_DIR}/${PROBE}'" >/dev/null 2>&1; then
    ok "A file written in one container is visible in the next — the mount is real"
    docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
      --entrypoint sh "${SERVICE}" -c "rm -f '${DB_DIR}/${PROBE}'" >/dev/null 2>&1 || true
  else
    fail "Wrote ${DB_DIR}/${PROBE} in one container but it was GONE in the next.
       ${DB_DIR} is not backed by persistent storage despite the declared mount.
       The database would be lost on deploy. Halted; no data was touched."
  fi
else
  fail "Could not write to ${DB_DIR} inside the container.
       Either the directory does not exist or the container user cannot write
       to it. Check ownership on the host: the app runs as uid 1001 (nextjs).
       Fix with:  sudo chown -R 1001:1001 ./db ./backups"
fi

# ── 4. Report what is already there, so a first deploy is distinguishable
#       from a deploy that is about to touch real data.
HOST_DB="$(docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
  --entrypoint sh "${SERVICE}" -c "test -f '${DB_PATH}' && wc -c < '${DB_PATH}' || echo 0" 2>/dev/null | tr -d '[:space:]')"

if [ "${HOST_DB:-0}" = "0" ]; then
  log "No existing database — this is a first-time initialisation."
  echo "EXISTING_DB=0"
else
  ok "Existing database present (${HOST_DB} bytes) — it must be backed up before any schema change."
  echo "EXISTING_DB=1"
fi

ok "Persistence preflight passed."
