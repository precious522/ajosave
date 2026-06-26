FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ── Web app ──────────────────────────────────────────────────────────────────
FROM base AS web
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

# ── BullMQ worker ─────────────────────────────────────────────────────────────
FROM base AS worker
RUN npm run build
CMD ["node", "dist/lib/queue/worker.js"]
