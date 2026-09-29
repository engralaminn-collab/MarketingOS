#!/usr/bin/env bash
#
# MarketingOS — SQLite backup with integrity verification.
#
# Run this BEFORE any schema change. It exits non-zero if it cannot produce a
# verified backup, so the caller can abort rather than risk the database.
#
#   DATABASE_URL   file: URL of the database (required, absolute path)
#   BACKUP_DIR     where to write backups      (default: <db dir>/../backups)
#   RETENTION      how many backups to keep    (default: 14)
#
# Prints the backup path on stdout as:  BACKUP_PATH=<path>
#
set -euo pipefail

log()  { printf '   %s\n' "$*" >&2; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

# ── Resolve the database path from DATABASE_URL ─────────────────────────────
: "${DATABASE_URL:?DATABASE_URL is required (e.g. file:/app/db/custom.db)}"

case "${DATABASE_URL}" in
  file:*) DB_PATH="${DATABASE_URL#file:}" ;;
  *)      fail "DATABASE_URL must be a file: URL for SQLite. Got a non-file URL." ;;
esac

case "${DB_PATH}" in
  /*) ;;
  *)  fail "Database path must be absolute, got: ${DB_PATH}
       A relative path resolves against the process working directory, which
       differs between the app, prisma and this script." ;;
esac

BACKUP_DIR="${BACKUP_DIR:-$(dirname "${DB_PATH}")/../backups}"
RETENTION="${RETENTION:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# ── No database yet is a legitimate first deploy, not a failure ─────────────
if [ ! -f "${DB_PATH}" ]; then
  log "No database at ${DB_PATH} — nothing to back up (first deploy)."
  echo "BACKUP_PATH="
  exit 0
fi

mkdir -p "${BACKUP_DIR}"
BACKUP_PATH="${BACKUP_DIR}/custom-${STAMP}.db"

# ── Take the backup ─────────────────────────────────────────────────────────
# `sqlite3 .backup` uses the online backup API: it is safe while the app is
# running and correct in WAL mode. A plain cp is NOT — it can capture a torn
# page or miss committed data still in the -wal file.
if command -v sqlite3 >/dev/null 2>&1; then
  log "Backing up with sqlite3 .backup (online, WAL-safe) ..."
  sqlite3 "${DB_PATH}" ".backup '${BACKUP_PATH}'" \
    || fail "sqlite3 .backup failed"
else
  # Fallback. Only sound if the app is stopped; warn loudly.
  log "⚠️  sqlite3 not installed — falling back to cp."
  log "    This is only consistent if the application is not writing."
  log "    Install sqlite3 on the host for a safe online backup."
  cp -p "${DB_PATH}" "${BACKUP_PATH}" || fail "cp backup failed"
  for sidecar in "-wal" "-shm"; do
    [ -f "${DB_PATH}${sidecar}" ] && cp -p "${DB_PATH}${sidecar}" "${BACKUP_PATH}${sidecar}" || true
  done
fi

# ── Verify it ───────────────────────────────────────────────────────────────
# A backup that was never checked is not a backup.
[ -f "${BACKUP_PATH}" ] || fail "Backup file was not created at ${BACKUP_PATH}"
[ -r "${BACKUP_PATH}" ] || fail "Backup file is not readable: ${BACKUP_PATH}"

BACKUP_SIZE="$(wc -c < "${BACKUP_PATH}" | tr -d ' ')"
[ "${BACKUP_SIZE}" -gt 0 ] || fail "Backup is empty: ${BACKUP_PATH}"

if command -v sqlite3 >/dev/null 2>&1; then
  log "Verifying backup integrity ..."
  INTEGRITY="$(sqlite3 "${BACKUP_PATH}" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "${INTEGRITY}" = "ok" ] \
    || fail "Backup failed integrity_check: ${INTEGRITY}"

  # A readable schema proves it is a usable SQLite file, not just bytes.
  TABLE_COUNT="$(sqlite3 "${BACKUP_PATH}" \
    "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0)"
  log "Integrity OK — ${TABLE_COUNT} tables, ${BACKUP_SIZE} bytes."
else
  log "sqlite3 unavailable — verified existence and non-zero size only (${BACKUP_SIZE} bytes)."
fi

# ── Retention: never delete the only backup ─────────────────────────────────
TOTAL="$(find "${BACKUP_DIR}" -maxdepth 1 -name 'custom-*.db' -type f | wc -l | tr -d ' ')"
if [ "${TOTAL}" -gt "${RETENTION}" ] && [ "${RETENTION}" -ge 1 ]; then
  log "Pruning to the newest ${RETENTION} backups (have ${TOTAL}) ..."
  # shellcheck disable=SC2012
  ls -1t "${BACKUP_DIR}"/custom-*.db | tail -n "+$((RETENTION + 1))" \
    | while read -r old; do rm -f "${old}" "${old}-wal" "${old}-shm"; done
fi

chmod 600 "${BACKUP_PATH}" 2>/dev/null || true

log "✅ Verified backup: ${BACKUP_PATH}"
echo "BACKUP_PATH=${BACKUP_PATH}"
