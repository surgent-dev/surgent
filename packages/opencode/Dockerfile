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
RUN HUSKY=0 bun install --frozen-lockfile

FROM oven/bun:1-slim AS production
WORKDIR /app
COPY --from=deps /app /app
COPY packages/opencode ./packages/opencode
COPY packages/util ./packages/util
ENV NODE_ENV=production PORT=4096
EXPOSE 4096
WORKDIR /app/packages/opencode
CMD ["bun", "src/index.ts"]
