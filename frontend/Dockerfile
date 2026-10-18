# =========================
# Dependencies stage
# =========================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm --version && node --version
RUN npm ci --no-audit --no-fund


# =========================
# Build stage
# =========================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build