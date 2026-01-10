# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY apps/dispatch/package.json ./apps/dispatch/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/opencode/package.json ./packages/opencode/
COPY packages/util/package.json ./packages/util/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN HUSKY=0 bun install --frozen-lockfile

FROM oven/bun:1-slim AS production
WORKDIR /app
COPY --from=deps /app /app
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
WORKDIR /app/apps/worker
CMD ["bun", "src/index.ts"]
