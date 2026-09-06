# ---- Base ----
FROM oven/bun:1 AS base
WORKDIR /app

# ---- Dependencies (workspace-aware, backend only) ----
FROM base AS deps
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
RUN bun install --frozen-lockfile --filter backend

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json bun.lock ./
COPY backend/package.json backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

WORKDIR /app/backend
EXPOSE 3000

# Default: run the API. The worker service overrides this command.
CMD ["bun", "run", "src/index.ts"]
