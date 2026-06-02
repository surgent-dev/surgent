# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY apps/dispatch/package.json ./apps/dispatch/
COPY apps/worker/package.json ./apps/worker/
COPY apps/analytics/package.json ./apps/analytics/
COPY packages/db/package.json ./packages/db/
COPY packages/gateway/package.json ./packages/gateway/
RUN HUSKY=0 bun install --frozen-lockfile

FROM oven/bun:1.3.11 AS builder
WORKDIR /app
COPY --from=deps /app /app
COPY apps/analytics ./apps/analytics
WORKDIR /app/apps/analytics
ARG REQUIRE_GEO_DATABASE=0
ARG REQUIRE_ANALYTICS_INTERNAL_TOKEN=0
RUN --mount=type=secret,id=maxmind_license_key \
  if [ -f /run/secrets/maxmind_license_key ]; then export MAXMIND_LICENSE_KEY="$(cat /run/secrets/maxmind_license_key)"; fi; \
  REQUIRE_ANALYTICS_INTERNAL_TOKEN="$REQUIRE_ANALYTICS_INTERNAL_TOKEN" \
  REQUIRE_GEO_DATABASE="$REQUIRE_GEO_DATABASE" \
  bun run build-docker

FROM oven/bun:1.3.11-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/analytics ./apps/analytics
ENV NODE_ENV=production PORT=3007
EXPOSE 3007
WORKDIR /app/apps/analytics
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "run", "start-docker"]
