# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY apps/dispatch/package.json ./apps/dispatch/
COPY apps/worker/package.json ./apps/worker/
COPY apps/pay/package.json ./apps/pay/
COPY packages/db/package.json ./packages/db/
COPY packages/util/package.json ./packages/util/
COPY packages/gateway/package.json ./packages/gateway/
RUN HUSKY=0 bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app /app
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
WORKDIR /app/apps/worker
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "src/index.ts"]
