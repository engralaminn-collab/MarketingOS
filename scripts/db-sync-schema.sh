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
#   BACKUP_PATH        path to a distinct, integrity-checked backup (required for existing databases)
#   A backup is mandatory for every existing database; no bypass is accepted.
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
  [ -n "${BACKUP_PATH:-}" ] || fail "BACKUP_PATH is required for an existing database."
  [ -f "${BACKUP_PATH}" ] && [ -s "${BACKUP_PATH}" ] || fail "A non-empty backup file is required."
  [ ! "${DB_PATH}" -ef "${BACKUP_PATH}" ] || fail "BACKUP_PATH must be a distinct file from the database."
  command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 is required to verify the backup."
  BACKUP_CHECK="$(sqlite3 "${BACKUP_PATH}" 'PRAGMA integrity_check;' 2>&1)" || fail "Backup verification failed."
  [ "${BACKUP_CHECK}" = "ok" ] || fail "Backup integrity_check failed."
  log "Backup integrity verified: ${BACKUP_PATH}"
  FROM_ARGS=(--from-url "${DATABASE_URL}")
else
  log "No database at ${DB_PATH} yet — this is a first-time initialisation."
  mkdir -p "$(dirname "${DB_PATH}")"
  FROM_ARGS=(--from-empty)
fi

# ── 2. Inspect the pending diff before applying anything ───────────────────
log "Computing the pending schema diff ..."
DIFF_SQL=""
if DIFF_SQL="$(bunx prisma migrate diff \
      "${FROM_ARGS[@]}" \
      --to-schema-datamodel prisma/schema.prisma \
      --script 2>/dev/null)"; then

  if [ -z "$(printf '%s' "${DIFF_SQL}" | tr -d '[:space:]')" ]; then
    log "✅ Schema already up to date — no changes to apply."
    exit 0
  fi

  log "Pending schema changes:"
  printf '%s\n' "${DIFF_SQL}" | sed 's/^/     | /' >&2

  # ── 3. Block destructive statements ──────────────────────────────────────
  # Refuse all table/index drops, including SQLite rebuilds; these need a
  # reviewed migration and restore rehearsal instead of automatic sync.
  DESTRUCTIVE="$(printf '%s\n' "${DIFF_SQL}" \
    | grep -iE '^[[:space:]]*(DROP[[:space:]]+(TABLE|INDEX)|ALTER[[:space:]]+TABLE[[:space:]]+.*[[:space:]]+DROP[[:space:]]+COLUMN)' || true)"

  if [ -n "${DESTRUCTIVE}" ]; then
    printf '❌ %s\n' "Refusing to apply a destructive schema change automatically." >&2
    printf '   %s\n' "The following statements would destroy data:" >&2
    printf '%s\n' "${DESTRUCTIVE}" | sed 's/^/     | /' >&2
    printf '   %s\n' "Review this deliberately and apply it by hand, with a restore plan." >&2
    printf '   %s\n' "Backup available at: ${BACKUP_PATH:-<none>}" >&2
    exit 1
  fi
else
  fail "Could not compute the schema diff. No schema changes were attempted."
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
