#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'NOTICE'
ERROR: This legacy one-click deploy script is disabled.

It contains unsafe, stale deployment behavior: it can create an unrelated GitHub
remote, stage every file, commit with hooks bypassed, pull/push `main`, apply
Prisma schema changes with `--accept-data-loss`, and print newly generated admin
credentials. None of those actions are appropriate for this checkout.

No files, branches, remotes, databases, or credentials were changed.

For the current deployment design, review docs/DEPLOYMENT.md and verify the
production host's Compose file, secrets, backups, schema sync, CI result, and
rollback plan before deploying. This script intentionally does not deploy.
NOTICE
exit 1
