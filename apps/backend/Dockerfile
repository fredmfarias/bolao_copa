# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
# OpenSSL is required by Prisma's Rust binaries (schema-engine, query-engine)
RUN apk add --no-cache openssl && corepack enable

# ── Install deps (cached layer) ───────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
# Schema must be present before install: backend `postinstall` runs `prisma generate`.
COPY apps/backend/prisma ./apps/backend/prisma
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/
# Compile shared package to JS (runtime needs dist/index.js via exports map)
RUN pnpm --filter @bolao/shared build
# Generate Prisma client for linux-alpine target
RUN pnpm --filter @bolao/backend exec prisma generate
# Compile NestJS app
RUN pnpm --filter @bolao/backend build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
# OpenSSL needed by Prisma query-engine and schema-engine at runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI for migrate deploy (runtime only — not in devDeps)
RUN npm install -g prisma@5 --no-fund --no-audit

# Workspace node_modules (includes Prisma native client for linux-alpine)
COPY --from=builder /app/node_modules ./node_modules
# Package-local node_modules (pnpm may place some deps here)
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
# packages/shared/dist/ is resolved at runtime via node_modules/@bolao/shared symlink
COPY --from=builder /app/packages ./packages
# Compiled backend
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
# Prisma schema + migrations (for migrate deploy)
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend
EXPOSE 3001
ENTRYPOINT ["sh", "-c", "prisma migrate deploy && exec node dist/main"]
