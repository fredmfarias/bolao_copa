# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable

# ── Install deps (cached layer) ───────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/
# NEXT_PUBLIC_* vars are baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @bolao/frontend build

# ── Runner (Next.js standalone) ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone/ contains server.js + minimal node_modules for the server
COPY --from=builder /app/apps/frontend/.next/standalone ./
# Static assets must be alongside the standalone server
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/frontend/server.js"]
