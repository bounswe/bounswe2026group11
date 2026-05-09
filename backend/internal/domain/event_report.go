package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	EventReportMessageMinLength = 1
	EventReportMessageMaxLength = 1000
)

const (
	ErrorCodeEventReportNotAllowed      = "event_report_not_allowed"
	ErrorCodeEventReportImageNotAllowed = "event_report_image_not_allowed"
)

// EventReportCategory defines the reason selected by a user when reporting an event.
type EventReportCategory string

const (
	EventReportCategorySafety               EventReportCategory = "SAFETY"
	EventReportCategoryHarassment           EventReportCategory = "HARASSMENT"
	EventReportCategorySpamOrScam           EventReportCategory = "SPAM_OR_SCAM"
	EventReportCategoryInappropriateContent EventReportCategory = "INAPPROPRIATE_CONTENT"
	EventReportCategoryEventNotAsDescribed  EventReportCategory = "EVENT_NOT_AS_DESCRIBED"
	EventReportCategoryIllegalOrDangerous   EventReportCategory = "ILLEGAL_OR_DANGEROUS"
	EventReportCategoryOther                EventReportCategory = "OTHER"
)

// EventReportStatus defines the moderation state for a submitted report.
type EventReportStatus string

const (
	EventReportStatusPending   EventReportStatus = "PENDING"
	EventReportStatusReviewed  EventReportStatus = "REVIEWED"
	EventReportStatusDismissed EventReportStatus = "DISMISSED"
)

var eventReportCategories = map[string]EventReportCategory{
	string(EventReportCategorySafety):               EventReportCategorySafety,
	string(EventReportCategoryHarassment):           EventReportCategoryHarassment,
	string(EventReportCategorySpamOrScam):           EventReportCategorySpamOrScam,
	string(EventReportCategoryInappropriateContent): EventReportCategoryInappropriateContent,
	string(EventReportCategoryEventNotAsDescribed):  EventReportCategoryEventNotAsDescribed,
	string(EventReportCategoryIllegalOrDangerous):   EventReportCategoryIllegalOrDangerous,
	string(EventReportCategoryOther):                EventReportCategoryOther,
}

var eventReportStatuses = map[string]EventReportStatus{
	string(EventReportStatusPending):   EventReportStatusPending,
	string(EventReportStatusReviewed):  EventReportStatusReviewed,
	string(EventReportStatusDismissed): EventReportStatusDismissed,
}

// ParseEventReportCategory converts a wire string to an EventReportCategory.
func ParseEventReportCategory(value string) (EventReportCategory, bool) {
	category, ok := eventReportCategories[value]
	return category, ok
}

// ParseEventReportStatus converts a wire string to an EventReportStatus.
func ParseEventReportStatus(value string) (EventReportStatus, bool) {
	status, ok := eventReportStatuses[value]
	return status, ok
}

func (s EventReportStatus) String() string {
	return string(s)
}

// EventReport stores a user-submitted report for an event.
type EventReport struct {
	ID             uuid.UUID
	EventID        uuid.UUID
	ReporterUserID uuid.UUID
	Category       EventReportCategory
	Message        string
	ImageURL       *string
	Status         EventReportStatus
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
