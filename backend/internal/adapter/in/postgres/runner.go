package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// execer abstracts pgxpool.Pool and pgx.Tx so repository methods can execute
// against either the default pool or an ambient transaction.
type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type txContextKey struct{}

type contextualRunner struct {
	fallback execer
}

func (r contextualRunner) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return runnerFromContext(ctx, r.fallback).Exec(ctx, sql, arguments...)
}

func (r contextualRunner) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return runnerFromContext(ctx, r.fallback).Query(ctx, sql, args...)
}

func (r contextualRunner) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return runnerFromContext(ctx, r.fallback).QueryRow(ctx, sql, args...)
}

func withTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, txContextKey{}, tx)
}

func txFromContext(ctx context.Context) pgx.Tx {
	tx, _ := ctx.Value(txContextKey{}).(pgx.Tx)
	return tx
}

func runnerFromContext(ctx context.Context, fallback execer) execer {
	if tx := txFromContext(ctx); tx != nil {
		return tx
	}

	return fallback
}
