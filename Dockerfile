# syntax=docker/dockerfile:1.7
# ═══════════════════════════════════════════════════════════════════════════
# MarketingOS — production image
#
# RUNTIME POLICY (see also .nvmrc, .node-version, package.json engines.node):
#   Application / production runtime .... Node 22  (base image below)
#   Package manager & script runner ..... Bun 1.x  (preserved — the repo is
#                                         designed around bun install/bun run)
#   GitHub Actions runner runtime ....... Node 24  (internal to the actions;
#                                         unrelated to this image)
#
# Node 22 is deliberate. Do NOT bump the base image to node:24.
#
# Referenced by .github/workflows/docker.yml (build & push) and consumed by
# .github/workflows/deploy.yml (pull & rolling restart on the VPS).
# ═══════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22
ARG BUN_VERSION=1.4.2

# Bun is taken from its official image rather than piped from an install
# script, so the build is reproducible and needs no network fetch of its own.
FROM oven/bun:${BUN_VERSION} AS bun

# ── Stage 1: dependencies ──────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# openssl + ca-certificates are required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Copy only manifests first so this layer caches until dependencies change.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=bun  /usr/local/bin/bun /usr/local/bin/bun
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client must be generated before the Next build so that imports of
# @prisma/client resolve to real types at build time.
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
RUN bunx prisma generate

# next.config.ts sets output:"standalone"; the build script then copies
# .next/static and public/ into the standalone tree.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# DATABASE_URL and JWT_SECRET are only needed for module resolution at build
# time; real values are injected at runtime by docker compose on the VPS.
ENV DATABASE_URL="file:./db/build.db"
ENV JWT_SECRET="build-time-placeholder-overridden-at-runtime"
RUN bun run build

# ── Stage 3: runtime ───────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Bun is kept in the runtime image because deploy.yml runs
# `docker compose run --rm app bunx prisma migrate deploy` against it.
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Next.js standalone output already contains the traced subset of node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema + Prisma CLI/engines, so migrations can run inside this image without
# reaching out to the network.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

# Uses Node 22's global fetch — no extra dependency required.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The server process runs on Node 22 — this is the production application
# runtime referred to throughout the docs. Bun above is the package manager.
CMD ["node", "server.js"]
