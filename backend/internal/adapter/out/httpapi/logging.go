package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
)

// LogInfo emits a structured info-level application log.
func LogInfo(ctx context.Context, msg string, attrs ...slog.Attr) {
	log(ctx, slog.LevelInfo, msg, attrs...)
}

func log(ctx context.Context, level slog.Level, msg string, attrs ...slog.Attr) {
	logger := slog.Default()
	if len(attrs) > 0 {
		logger.LogAttrs(ctx, level, msg, attrs...)
		return
	}
	logger.Log(ctx, level, msg)
}

// UserIDAttr records the authenticated user ID for log correlation.
func UserIDAttr(userID uuid.UUID) slog.Attr {
	return slog.String("user_id", userID.String())
}

// OptionalUserIDAttr records the caller identity, or "anonymous" when the
// request is not authenticated.
func OptionalUserIDAttr(userID uuid.UUID) slog.Attr {
	if userID == uuid.Nil {
		return slog.String("user_id", "anonymous")
	}
	return UserIDAttr(userID)
}

func EventIDAttr(eventID uuid.UUID) slog.Attr {
	return slog.String("event_id", eventID.String())
}

func JoinRequestIDAttr(joinRequestID uuid.UUID) slog.Attr {
	return slog.String("join_request_id", joinRequestID.String())
}

func FavoriteLocationIDAttr(favoriteLocationID uuid.UUID) slog.Attr {
	return slog.String("favorite_location_id", favoriteLocationID.String())
}

func ParticipantUserIDAttr(userID uuid.UUID) slog.Attr {
	return slog.String("participant_user_id", userID.String())
}

func QuerySummaryAttr(summary string) slog.Attr {
	return slog.String("query_summary", summary)
}

func OperationAttr(operation string) slog.Attr {
	return slog.String("operation", operation)
}

func BoolSummary(label string, value bool) string {
	if value {
		return label + "=true"
	}
	return label + "=false"
}

func CountSummary(label string, value int) string {
	return fmt.Sprintf("%s=%d", label, value)
}

func StringSummary(label, value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return label + "=<empty>"
	}
	return fmt.Sprintf("%s=%s", label, trimmed)
}

func StringPtrSummary(label string, value *string) string {
	if value == nil {
		return label + "=<nil>"
	}
	return StringSummary(label, *value)
}

func JoinSummary(parts ...string) string {
	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			filtered = append(filtered, part)
		}
	}
	return strings.Join(filtered, " ")
}
