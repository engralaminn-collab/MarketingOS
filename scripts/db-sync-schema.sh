#!/usr/bin/env bash
#
# MarketingOS — safe production schema synchronisation.
#
# This project has no prisma/migrations directory: deploy.sh, package.json and
# the docs all use `prisma db push`. So `prisma migrate deploy` could never
# work here, and `db push --accept-data-loss` would silently drop columns.
#
# This script therefore:
#   1. requires a verified backup to already exist,
#   2. inspects the pending schema diff and reports it,
#   3. refuses to continue if the change is destructive,
#   4. applies the change WITHOUT --accept-data-loss,
#   5. verifies the database afterwards.
#
# Any failure exits non-zero so the deployment stops with data intact.
#
#   DATABASE_URL       file: URL, absolute (required)
#   BACKUP_PATH        path to the verified backup (required unless ALLOW_NO_BACKUP=1)
#   ALLOW_NO_BACKUP    set to 1 only on a first deploy with no existing database
#
set -euo pipefail

log()  { printf '   %s\n' "$*" >&2; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

: "${DATABASE_URL:?DATABASE_URL is required}"
case "${DATABASE_URL}" in
  file:*) DB_PATH="${DATABASE_URL#file:}" ;;
  *)      fail "DATABASE_URL must be a file: URL for SQLite." ;;
esac
case "${DB_PATH}" in /*) ;; *) fail "Database path must be absolute: ${DB_PATH}" ;; esac

# ── 1. A verified backup must exist before we touch the schema ─────────────
if [ -f "${DB_PATH}" ]; then
  if [ "${ALLOW_NO_BACKUP:-0}" != "1" ]; then
    [ -n "${BACKUP_PATH:-}" ] \
      || fail "BACKUP_PATH is empty but ${DB_PATH} exists.
       Run scripts/db-backup.sh first. Refusing to change the schema of a
       database that has not been backed up."
    [ -f "${BACKUP_PATH}" ] \
      || fail "BACKUP_PATH does not exist: ${BACKUP_PATH}"
    [ -s "${BACKUP_PATH}" ] \
      || fail "BACKUP_PATH is empty: ${BACKUP_PATH}"
    log "Backup confirmed present: ${BACKUP_PATH}"
  else
    log "⚠️  ALLOW_NO_BACKUP=1 — proceeding without a backup by explicit request."
  fi
else
  log "No database at ${DB_PATH} yet — this is a first-time initialisation."
  mkdir -p "$(dirname "${DB_PATH}")"
fi

# ── 2. Inspect the pending diff before applying anything ───────────────────
log "Computing the pending schema diff ..."
DIFF_SQL=""
if DIFF_SQL="$(bunx prisma migrate diff \
      --from-url "${DATABASE_URL}" \
      --to-schema-datamodel prisma/schema.prisma \
      --script 2>/dev/null)"; then

  if [ -z "$(printf '%s' "${DIFF_SQL}" | tr -d '[:space:]')" ]; then
    log "✅ Schema already up to date — no changes to apply."
    exit 0
  fi

  log "Pending schema changes:"
  printf '%s\n' "${DIFF_SQL}" | sed 's/^/     | /' >&2

  # ── 3. Block destructive statements ──────────────────────────────────────
  # DROP TABLE / DROP COLUMN destroy data. Prisma also emits table rebuilds for
  # SQLite; those are fine, but an outright DROP of a real table is not.
  DESTRUCTIVE="$(printf '%s\n' "${DIFF_SQL}" \
    | grep -iE '^\s*(DROP\s+TABLE|ALTER\s+TABLE\s+.*\s+DROP\s+COLUMN)' \
    | grep -viE '"_prisma_|_new"|_old"|__temp' || true)"

  if [ -n "${DESTRUCTIVE}" ]; then
    printf '❌ %s\n' "Refusing to apply a destructive schema change automatically." >&2
    printf '   %s\n' "The following statements would destroy data:" >&2
    printf '%s\n' "${DESTRUCTIVE}" | sed 's/^/     | /' >&2
    printf '   %s\n' "Review this deliberately and apply it by hand, with a restore plan." >&2
    printf '   %s\n' "Backup available at: ${BACKUP_PATH:-<none>}" >&2
    exit 1
  fi
else
  log "⚠️  Could not compute a diff (new database, or the schema engine is unavailable)."
  log "    Continuing: db push below still refuses destructive changes on its own."
fi

# ── 4. Apply, without --accept-data-loss ───────────────────────────────────
log "Applying schema with prisma db push (non-destructive) ..."
if ! bunx prisma db push --skip-generate; then
  fail "Schema synchronisation failed. The database is unchanged where Prisma
       could not apply safely. Backup: ${BACKUP_PATH:-<none>}
       Nothing was force-applied — --accept-data-loss is deliberately not used."
fi

# ── 5. Verify afterwards ───────────────────────────────────────────────────
if command -v sqlite3 >/dev/null 2>&1 && [ -f "${DB_PATH}" ]; then
  POST="$(sqlite3 "${DB_PATH}" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "${POST}" = "ok" ] || fail "Database fails integrity_check after sync: ${POST}
       Restore with: scripts/db-restore.sh ${BACKUP_PATH:-<backup>}"
  TABLES="$(sqlite3 "${DB_PATH}" "SELECT count(*) FROM sqlite_master WHERE type='table';")"
  log "✅ Schema synchronised — ${TABLES} tables, integrity OK."
else
  log "✅ Schema synchronised (sqlite3 unavailable for post-verification)."
fi
