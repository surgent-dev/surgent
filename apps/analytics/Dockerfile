# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY apps/dispatch/package.json ./apps/dispatch/
COPY apps/worker/package.json ./apps/worker/
COPY apps/analytics/package.json ./apps/analytics/
COPY packages/db/package.json ./packages/db/
COPY packages/gateway/package.json ./packages/gateway/
RUN HUSKY=0 bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app /app
COPY apps/analytics ./apps/analytics
WORKDIR /app/apps/analytics
RUN bun run build-docker

FROM oven/bun:1-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app
WORKDIR /app
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/analytics ./apps/analytics
USER app
ENV NODE_ENV=production PORT=3007
EXPOSE 3007
WORKDIR /app/apps/analytics
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "run", "start-docker"]
