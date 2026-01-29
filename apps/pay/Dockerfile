# syntax=docker/dockerfile:1
FROM rust:1-alpine AS builder

RUN apk add --no-cache musl-dev tini-static openssl-dev openssl-libs-static pkgconfig curl

WORKDIR /app

COPY . .

ENV SQLX_OFFLINE=true
ENV OPENSSL_STATIC=1

RUN cargo build --release --bin surpay

# RUNTIME
FROM scratch

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/foreveranapple/surpay" \
      org.opencontainers.image.description="Surpay - Payment processing service" \
      org.opencontainers.image.licenses="Proprietary"

COPY --from=builder /app/target/release/surpay ./surpay
COPY --from=builder /sbin/tini-static /tini
COPY --from=builder /app/migrations ./migrations

ENV SERVICE_HOST=0.0.0.0
ENV SERVICE_PORT=8090

EXPOSE 8090

COPY --from=ghcr.io/tarampampam/microcheck:1 /bin/httpcheck /bin/httpcheck

HEALTHCHECK --interval=5s --retries=2 CMD ["httpcheck", "http://127.0.0.1:8090/health"]

ENTRYPOINT ["/tini", "--"]
CMD ["./surpay"]
