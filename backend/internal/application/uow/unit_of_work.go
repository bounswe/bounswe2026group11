package uow

import "context"

// UnitOfWork scopes a single atomic application operation.
// Implementations commit on successful callback completion and roll back on error.
type UnitOfWork interface {
	RunInTx(ctx context.Context, fn func(ctx context.Context) error) error
}
