package postgres

import (
	"context"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type txStarter interface {
	BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error)
}

// UnitOfWork is the Postgres-backed implementation of the application UoW port.
// Nested RunInTx calls reuse the ambient transaction from context, and the fixed
// transaction variant is intended for rollback-only integration harnesses.
type UnitOfWork struct {
	starter txStarter
	fixedTx pgx.Tx
}

var _ uow.UnitOfWork = (*UnitOfWork)(nil)

func NewUnitOfWork(pool *pgxpool.Pool) *UnitOfWork {
	return &UnitOfWork{starter: pool}
}

func NewUnitOfWorkWithTx(pool *pgxpool.Pool, tx pgx.Tx) *UnitOfWork {
	return &UnitOfWork{
		starter: pool,
		fixedTx: tx,
	}
}

func (u *UnitOfWork) RunInTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if tx := txFromContext(ctx); tx != nil {
		return fn(ctx)
	}

	if u.fixedTx != nil {
		return fn(withTx(ctx, u.fixedTx))
	}

	tx, err := u.starter.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	txCtx := withTx(ctx, tx)
	if err := fn(txCtx); err != nil {
		_ = tx.Rollback(txCtx)
		return err
	}

	if err := tx.Commit(txCtx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
