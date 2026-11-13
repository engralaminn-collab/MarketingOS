#!/usr/bin/env bash
# First-run setup for a self-hosted MarketingOS instance.
# Safe to re-run: preserves .env and an existing database; never downloads AI models.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { printf 'Setup error: %s\n' "$*" >&2; exit 1; }
command -v node >/dev/null || fail 'Node.js 22 is required.'
node -e 'if (Number(process.versions.node.split(".")[0]) !== 22) process.exit(1)' || fail "Expected Node.js 22; found $(node --version)."
command -v bun >/dev/null || fail 'Bun 1.x is required. Install Bun, then rerun scripts/setup.sh.'

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  printf 'Created .env from .env.example. Review provider, URL, and credentials before exposing this service.\n'
fi

# Generate a strong secret only when the template value is still present/empty.
if grep -Eq '^(JWT_SECRET|NEXTAUTH_SECRET)=[[:space:]]*(""|CHANGE_ME|your-secret-here)?[[:space:]]*$' .env; then
  secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  if grep -q '^JWT_SECRET=' .env; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$secret\"|" .env
  else
    printf '\nJWT_SECRET="%s"\n' "$secret" >> .env
  fi
  chmod 600 .env
  unset secret
fi

bun install --frozen-lockfile
bunx prisma generate
mkdir -p db
# Do not use --accept-data-loss during setup; Prisma will stop on destructive drift.
bunx prisma db push
if [[ "${SKIP_SEED:-0}" != 1 ]]; then
  bunx tsx prisma/seed.ts
fi

printf '\nSetup complete. Start with: bun run dev\n'
printf 'Health check: http://localhost:3000/api/health\n'
printf 'Before production: configure HTTPS, persistent ./db storage, backups, and GitHub deployment secrets.\n'
