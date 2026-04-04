package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type fakeTxStarter struct {
	beginCount int
	tx         pgx.Tx
	err        error
}

func (s *fakeTxStarter) BeginTx(_ context.Context, _ pgx.TxOptions) (pgx.Tx, error) {
	s.beginCount++
	if s.err != nil {
		return nil, s.err
	}

	return s.tx, nil
}

type fakeTx struct {
	commitCount   int
	rollbackCount int
}

func (t *fakeTx) Begin(_ context.Context) (pgx.Tx, error) { return t, nil }

func (t *fakeTx) Commit(_ context.Context) error {
	t.commitCount++
	return nil
}

func (t *fakeTx) Rollback(_ context.Context) error {
	t.rollbackCount++
	return nil
}

func (t *fakeTx) CopyFrom(_ context.Context, _ pgx.Identifier, _ []string, _ pgx.CopyFromSource) (int64, error) {
	return 0, nil
}

func (t *fakeTx) SendBatch(_ context.Context, _ *pgx.Batch) pgx.BatchResults { return nil }

func (t *fakeTx) LargeObjects() pgx.LargeObjects { return pgx.LargeObjects{} }

func (t *fakeTx) Prepare(_ context.Context, _, _ string) (*pgconn.StatementDescription, error) {
	return nil, nil
}

func (t *fakeTx) Exec(_ context.Context, _ string, _ ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

func (t *fakeTx) Query(_ context.Context, _ string, _ ...any) (pgx.Rows, error) { return nil, nil }

func (t *fakeTx) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row { return fakeRow{} }

func (t *fakeTx) Conn() *pgx.Conn { return nil }

type fakeRow struct{}

func (r fakeRow) Scan(_ ...any) error { return pgx.ErrNoRows }

func TestUnitOfWorkCommitsOnSuccess(t *testing.T) {
	tx := &fakeTx{}
	uow := &UnitOfWork{starter: &fakeTxStarter{tx: tx}}

	err := uow.RunInTx(context.Background(), func(ctx context.Context) error {
		if txFromContext(ctx) != tx {
			t.Fatal("expected transaction to be attached to context")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("RunInTx() error = %v", err)
	}
	if tx.commitCount != 1 || tx.rollbackCount != 0 {
		t.Fatalf("expected commit without rollback, got commits=%d rollbacks=%d", tx.commitCount, tx.rollbackCount)
	}
}

func TestUnitOfWorkRollsBackOnCallbackError(t *testing.T) {
	tx := &fakeTx{}
	uow := &UnitOfWork{starter: &fakeTxStarter{tx: tx}}
	expectedErr := errors.New("boom")

	err := uow.RunInTx(context.Background(), func(context.Context) error {
		return expectedErr
	})

	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
	if tx.rollbackCount != 1 || tx.commitCount != 0 {
		t.Fatalf("expected rollback without commit, got commits=%d rollbacks=%d", tx.commitCount, tx.rollbackCount)
	}
}

func TestUnitOfWorkRollsBackOnCanceledContext(t *testing.T) {
	tx := &fakeTx{}
	uow := &UnitOfWork{starter: &fakeTxStarter{tx: tx}}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := uow.RunInTx(ctx, func(ctx context.Context) error {
		return ctx.Err()
	})

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
	if tx.rollbackCount != 1 || tx.commitCount != 0 {
		t.Fatalf("expected rollback without commit, got commits=%d rollbacks=%d", tx.commitCount, tx.rollbackCount)
	}
}

func TestUnitOfWorkReusesNestedTransaction(t *testing.T) {
	tx := &fakeTx{}
	starter := &fakeTxStarter{tx: tx}
	uow := &UnitOfWork{starter: starter}

	err := uow.RunInTx(context.Background(), func(ctx context.Context) error {
		return uow.RunInTx(ctx, func(inner context.Context) error {
			if txFromContext(inner) != tx {
				t.Fatal("expected nested unit of work to reuse transaction from context")
			}
			return nil
		})
	})

	if err != nil {
		t.Fatalf("RunInTx() error = %v", err)
	}
	if starter.beginCount != 1 {
		t.Fatalf("expected one transaction begin, got %d", starter.beginCount)
	}
	if tx.commitCount != 1 || tx.rollbackCount != 0 {
		t.Fatalf("expected one commit without rollback, got commits=%d rollbacks=%d", tx.commitCount, tx.rollbackCount)
	}
}
