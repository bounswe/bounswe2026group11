package postgres

import (
	"testing"
	"time"

	commentapp "github.com/bounswe/bounswe2026group11/backend/internal/application/comment"
	"github.com/google/uuid"
)

func TestBuildCommentCursorClauseUsesComparator(t *testing.T) {
	// given
	cursor := &commentapp.CommentCursor{
		Collection: "REPLIES",
		CreatedAt:  time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC),
		CommentID:  uuid.New(),
	}
	args := []any{"event-id", "parent-id"}

	// when
	clause := buildCommentCursorClause(commentapp.ListCommentsParams{DecodedCursor: cursor}, &args, "ec.created_at", "ec.id", commentCursorAfter)

	// then
	if clause != "AND (ec.created_at, ec.id) > ($3, $4)" {
		t.Fatalf("expected ascending cursor clause, got %q", clause)
	}
	if len(args) != 4 || args[2] != cursor.CreatedAt || args[3] != cursor.CommentID {
		t.Fatalf("expected cursor args to be appended, got %#v", args)
	}
}
