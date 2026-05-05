# syntax=docker/dockerfile:1.4
#
# Multi-stage build for the Lighthouse Checker.
# Stage 1 builds the Next app and compiles better-sqlite3's native bindings.
# Stage 2 produces a slim runtime image with Chromium installed for Lighthouse.

# ----------------------------------------------------------------------------
# Stage 1 — install deps + build
# ----------------------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

# better-sqlite3 needs python3 + a C/C++ toolchain to compile native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev-only deps to slim the node_modules we copy forward.
RUN npm prune --omit=dev

# ----------------------------------------------------------------------------
# Stage 2 — runtime
# ----------------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    LIGHTHOUSE_DB_PATH=/data/lighthouse.db \
    PORT=3000

# Chromium + the minimal X11/font/render libs Chrome needs even in headless
# mode. Without these, Chrome aborts before Lighthouse can attach.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./

# Mount points for persistence. /data holds the SQLite file; mount it as a
# volume on the host. /app/public/reports holds generated HTML+JSON reports
# and is rebuilt on demand — mount a volume there too if you want them
# persistent across deploys.
RUN mkdir -p /data /app/public/reports
VOLUME ["/data"]

EXPOSE 3000
CMD ["npm", "start"]
