# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/opencode/package.json ./packages/opencode/
COPY packages/util/package.json ./packages/util/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock bunfig.toml ./
COPY packages/opencode ./packages/opencode
COPY packages/util ./packages/util
COPY packages/typescript-config ./packages/typescript-config

FROM oven/bun:1-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/packages/opencode ./packages/opencode
COPY --from=builder --chown=bun:bun /app/packages/util ./packages/util
COPY --from=builder --chown=bun:bun /app/packages/typescript-config ./packages/typescript-config
COPY --from=builder --chown=bun:bun /app/package.json ./
COPY --from=ghcr.io/tarampampam/microcheck:1 /bin/httpcheck /bin/httpcheck
ENV NODE_ENV=production PORT=4096
USER bun
EXPOSE 4096
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD ["httpcheck", "http://127.0.0.1:4096/global/health"]
WORKDIR /app/packages/opencode
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "src/index.ts"]
