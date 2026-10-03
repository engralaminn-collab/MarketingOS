#!/usr/bin/env bash
#
# MarketingOS — restore a SQLite backup produced by scripts/db-backup.sh.
#
#   scripts/db-restore.sh <backup-file> [--force]
#   scripts/db-restore.sh --list
#
# Safety:
#   * The backup is integrity-checked BEFORE the live database is touched.
#   * The current database is itself backed up first, so a restore is undoable.
#   * Refuses to run unless the application is stopped, unless --force is given.
#
set -euo pipefail

log()  { printf '   %s\n' "$*" >&2; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

: "${DATABASE_URL:?DATABASE_URL is required (e.g. file:/app/db/custom.db)}"
case "${DATABASE_URL}" in
  file:*) DB_PATH="${DATABASE_URL#file:}" ;;
  *)      fail "DATABASE_URL must be a file: URL for SQLite." ;;
esac
case "${DB_PATH}" in /*) ;; *) fail "Database path must be absolute: ${DB_PATH}" ;; esac

BACKUP_DIR="${BACKUP_DIR:-$(dirname "${DB_PATH}")/../backups}"

if [ "${1:-}" = "--list" ]; then
  echo "Backups in ${BACKUP_DIR}:"
  if compgen -G "${BACKUP_DIR}/custom-*.db" >/dev/null; then
    # shellcheck disable=SC2012
    ls -1lht "${BACKUP_DIR}"/custom-*.db
  else
    echo "  (none)"
  fi
  exit 0
fi

BACKUP_FILE="${1:-}"
FORCE="${2:-}"
[ -n "${BACKUP_FILE}" ] || fail "Usage: $0 <backup-file> [--force]   |   $0 --list"
[ -f "${BACKUP_FILE}" ] || fail "Backup not found: ${BACKUP_FILE}"

# ── Verify the backup BEFORE touching anything live ─────────────────────────
if command -v sqlite3 >/dev/null 2>&1; then
  log "Verifying ${BACKUP_FILE} ..."
  INTEGRITY="$(sqlite3 "${BACKUP_FILE}" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "${INTEGRITY}" = "ok" ] || fail "Backup is corrupt (integrity_check: ${INTEGRITY}). Restore aborted."
  TABLES="$(sqlite3 "${BACKUP_FILE}" "SELECT count(*) FROM sqlite_master WHERE type='table';")"
  [ "${TABLES}" -gt 0 ] || fail "Backup contains no tables. Restore aborted."
  log "Backup verified — ${TABLES} tables."
else
  log "⚠️  sqlite3 unavailable; cannot verify backup integrity before restore."
  [ "${FORCE}" = "--force" ] || fail "Refusing to restore unverified backup without --force."
fi

# ── Refuse to overwrite a database that is in use ───────────────────────────
if [ "${FORCE}" != "--force" ] && command -v fuser >/dev/null 2>&1; then
  if fuser "${DB_PATH}" >/dev/null 2>&1; then
    fail "${DB_PATH} is open by a running process.
       Stop the application first (docker compose stop app), then retry.
       Use --force only if you are certain nothing is writing."
  fi
fi

# ── Make the restore itself undoable ────────────────────────────────────────
if [ -f "${DB_PATH}" ]; then
  PRE="${BACKUP_DIR}/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).db"
  mkdir -p "${BACKUP_DIR}"
  log "Snapshotting the current database to ${PRE} ..."
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${DB_PATH}" ".backup '${PRE}'" || fail "Could not snapshot the current database; aborting."
  else
    cp -p "${DB_PATH}" "${PRE}" || fail "Could not snapshot the current database; aborting."
  fi
  log "Current database preserved at ${PRE}"
fi

# ── Restore ─────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${DB_PATH}")"
cp -p "${BACKUP_FILE}" "${DB_PATH}"
# Stale WAL/SHM from the replaced database would corrupt the restored one.
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
chmod 600 "${DB_PATH}" 2>/dev/null || true

if command -v sqlite3 >/dev/null 2>&1; then
  POST="$(sqlite3 "${DB_PATH}" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "${POST}" = "ok" ] || fail "Restored database fails integrity_check: ${POST}"
fi

log "✅ Restored ${BACKUP_FILE} -> ${DB_PATH}"
log "   Start the application and confirm /api/health before considering this done."
