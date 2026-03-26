package postgres

import (
	"errors"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestMapEventInsertErrorCategoryFK(t *testing.T) {
	t.Parallel()

	pgErr := &pgconn.PgError{Code: "23503", ConstraintName: "fk_event_category"}
	out := mapEventInsertError(pgErr)
	appErr, ok := out.(*domain.AppError)
	if !ok {
		t.Fatalf("expected *domain.AppError, got %T", out)
	}
	if appErr.Status != domain.StatusBadRequest {
		t.Fatalf("status: got %d want %d", appErr.Status, domain.StatusBadRequest)
	}
	if got := appErr.Details["category_id"]; got == "" {
		t.Fatal("expected category_id detail")
	}
}

func TestMapEventInsertErrorHostTitleUnique(t *testing.T) {
	t.Parallel()

	pgErr := &pgconn.PgError{Code: "23505", ConstraintName: "uq_event_host_title"}
	out := mapEventInsertError(pgErr)
	appErr, ok := out.(*domain.AppError)
	if !ok {
		t.Fatalf("expected *domain.AppError, got %T", out)
	}
	if appErr.Status != domain.StatusConflict {
		t.Fatalf("status: got %d want %d", appErr.Status, domain.StatusConflict)
	}
	if appErr.Code != domain.ErrorCodeEventTitleExists {
		t.Fatalf("code: got %q want %q", appErr.Code, domain.ErrorCodeEventTitleExists)
	}
}

func TestMapEventInsertErrorPassthrough(t *testing.T) {
	t.Parallel()

	err := errors.New("other")
	if mapEventInsertError(err) != err {
		t.Fatal("expected original error")
	}
}
