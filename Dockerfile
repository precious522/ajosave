FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ── deps: install production deps only ────────────────────────────────────────
FROM base AS deps
RUN npm ci --omit=dev

# ── builder: full install + build ─────────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ── runner: lean production image ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/tsconfig.json ./
COPY package.json ./

USER appuser
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/ts-node scripts/migrate.ts up && node_modules/.bin/next start"]
