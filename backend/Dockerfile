# syntax=docker/dockerfile:1
#
# Multi-stage build: the final image only contains the compiled server, SQL migrations,
# and the migrate tool — not the full Go SDK. That keeps the image small and deploys faster.

# --- Build the API binary (full Go SDK on Debian; output is still static / CGO-disabled). ---
FROM golang:1.24-bookworm AS builder

WORKDIR /src

# Copy module files first so `go mod download` is cached until dependencies change.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 produces a static binary that runs on Alpine (musl) without linking glibc.
# -trimpath strips local paths from the binary; -s -w strip debug info to shrink size.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# --- Borrow only the official `migrate` binary; same version the entrypoint expects. ---
FROM migrate/migrate:v4.18.2 AS migrate

# --- Runtime: Alpine + TLS roots (for HTTPS clients) + app + migrations + entrypoint. ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=migrate /migrate /usr/local/bin/migrate
RUN chmod +x /usr/local/bin/migrate

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY migrations /migrations
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Document the port; compose maps this to the host.
EXPOSE 8080

# Entrypoint applies pending migrations, then execs the HTTP server.
ENTRYPOINT ["/docker-entrypoint.sh"]
