# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app
# Copy workspace package.json files for monorepo resolution
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/dispatch/package.json ./apps/dispatch/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/opencode/package.json ./packages/opencode/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/util/package.json ./packages/util/
# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy workspace files
COPY package.json bun.lock ./
COPY apps/worker ./apps/worker
COPY packages ./packages

FROM oven/bun:1-slim AS production
WORKDIR /app
# Copy node_modules and application code from builder
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/apps/worker ./apps/worker
COPY --from=builder --chown=bun:bun /app/packages ./packages
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
# Copy microcheck binary for health check
COPY --from=ghcr.io/tarampampam/microcheck:1 /bin/httpcheck /bin/httpcheck
# Set environment
ENV PORT=4000
# OCI labels
LABEL org.opencontainers.image.source="https://github.com/daaaaa/surgent" \
      org.opencontainers.image.description="Bun-based Hono API server for Surgent worker"
# Switch to non-root user
USER bun
# Expose port
EXPOSE 4000
# Health check
HEALTHCHECK --interval=5s --retries=2 CMD ["httpcheck", "http://127.0.0.1:4000/health"]
# Set working directory to worker app
WORKDIR /app/apps/worker
# Run application
CMD ["bun", "src/index.ts"]
