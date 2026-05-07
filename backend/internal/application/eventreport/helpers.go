package eventreport

import (
	"strings"
	"unicode/utf8"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func normalizeMessage(message string) string {
	return strings.TrimSpace(message)
}

func validateMessage(message string) map[string]string {
	errs := make(map[string]string)
	length := utf8.RuneCountInString(message)
	if length < domain.EventReportMessageMinLength || length > domain.EventReportMessageMaxLength {
		errs["message"] = "message must be between 1 and 1000 characters"
	}
	return errs
}

func toEventReportResult(record *EventReportRecord) *EventReportResult {
	return &EventReportResult{
		ID:             record.ID.String(),
		EventID:        record.EventID.String(),
		ReporterUserID: record.ReporterUserID.String(),
		Category:       string(record.Category),
		Message:        record.Message,
		ImageURL:       record.ImageURL,
		Status:         string(record.Status),
		CreatedAt:      record.CreatedAt,
	}
}
