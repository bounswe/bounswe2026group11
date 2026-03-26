#!/usr/bin/env bash
# Run all local checks before opening a PR or tagging a release: modules, format,
# vet, static analysis, vulnerability scan, build, unit tests, and integration tests.
# Does not build Docker images.
#
# Requirements:
#   - Go toolchain matching backend/go.mod
#   - Docker running (for integration tests using testcontainers)
#
# Optional:
#   - SKIP_INTEGRATION=1  Skip integration tests (not a full gate).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

step() { printf '\n==> %s\n' "$1"; }

die() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

in_git_repo() {
  command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

step "Go modules (tidy + verify)"
if in_git_repo; then
  go mod tidy
  if ! git -C "$ROOT" diff --exit-code -- go.mod go.sum >/dev/null 2>&1; then
    die "go mod tidy changed go.mod or go.sum; commit those changes and re-run"
  fi
else
  printf 'WARN: not in a git worktree; skipping tidy-vs-git diff (run from a clone for a full check).\n' >&2
fi
go mod verify

step "gofmt (check)"
fmt_out="$(gofmt -l .)"
if [[ -n "$fmt_out" ]]; then
  printf 'These files need gofmt:\n%s\n' "$fmt_out" >&2
  die "run: gofmt -w ."
fi

step "go vet"
go vet ./...

step "staticcheck"
go run honnef.co/go/tools/cmd/staticcheck@latest ./...

step "govulncheck"
go run golang.org/x/vuln/cmd/govulncheck@latest ./...

step "golangci-lint"
go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest run ./...

step "gosec"
go run github.com/securego/gosec/v2/cmd/gosec@latest -quiet ./...

step "go build (server)"
go build -o /dev/null ./cmd/server

step "Unit tests (race detector)"
go test -race -count=1 ./...

if [[ "${SKIP_INTEGRATION:-}" == "1" ]]; then
  printf '\nWARN: SKIP_INTEGRATION=1 — integration tests were not run.\n' >&2
else
  step "Integration tests (race, -tags=integration; Docker must be running)"
  go test -race -count=1 -tags=integration ./tests/integration/...
fi

step "All backend checks passed."
