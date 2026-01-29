# syntax=docker/dockerfile:1
# CHEF STAGE - Base image with Rust and cargo-chef installed
FROM rust:1-alpine AS chef

# Install musl-dev for Alpine builds and tini-static for signal handling
RUN apk add --no-cache musl-dev tini-static curl

# Install cargo-chef for dependency caching
RUN cargo install cargo-chef

WORKDIR /app

# PLANNER STAGE - Creates recipe.json with dependency information
FROM chef AS planner

# Copy all source files needed to analyze dependencies
COPY . .

# Prepare recipe file containing dependency information
RUN cargo chef prepare --recipe-path recipe.json

# BUILDER STAGE - Compiles Rust binaries with dependency caching
FROM chef AS builder

# Copy recipe from planner stage
COPY --from=planner /app/recipe.json recipe.json

# Download and compile dependencies only (cached layer)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    cargo chef cook --release --locked --recipe-path recipe.json

# Copy source code (includes apps/pay/.sqlx/ for offline sqlx compilation)
COPY . .

# Build without database connection using offline sqlx data
ENV SQLX_OFFLINE=true

# Build the binary (dependencies are cached from cook step)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked --bin surpay

# Copy binary out of cache to a fixed location
RUN --mount=type=cache,target=/app/target \
    cp /app/target/release/surpay /app/surpay-bin

# RUNTIME STAGE - Empty scratch image for minimal size
FROM scratch

# Set working directory
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/foreveranapple/surpay" \
      org.opencontainers.image.description="Surpay - Payment processing service" \
      org.opencontainers.image.licenses="Proprietary"

# this is the built bin from previous stage
COPY --from=builder /app/surpay-bin ./surpay

# Copy tini init system from builder
COPY --from=builder /sbin/tini-static /tini

# required for auto-migration on startup
COPY --from=builder /app/apps/pay/migrations ./migrations

ENV SERVICE_HOST=0.0.0.0
ENV SERVICE_PORT=8090

EXPOSE 8090

# super tiny health check
COPY --from=ghcr.io/tarampampam/microcheck:1 /bin/httpcheck /bin/httpcheck

# docs: <https://docs.docker.com/reference/dockerfile#healthcheck>
HEALTHCHECK --interval=5s --retries=2 CMD ["httpcheck", "http://127.0.0.1:8090/health"]

ENTRYPOINT ["/tini", "--"]
CMD ["./surpay"]
