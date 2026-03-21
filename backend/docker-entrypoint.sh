#!/bin/sh
# docker-entrypoint.sh — Applies pending database migrations with golang-migrate,
# then execs the Go HTTP server as PID 1 so it receives OS signals directly.
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"

db_port="${DB_PORT:-5432}"
if [ -n "${DB_PASSWORD:-}" ]; then
	db_url="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${db_port}/${DB_NAME}?sslmode=disable"
else
	db_url="postgres://${DB_USER}@${DB_HOST}:${db_port}/${DB_NAME}?sslmode=disable"
fi

migrate -path /migrations -database "$db_url" up

exec /app/server
