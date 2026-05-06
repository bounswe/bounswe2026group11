package eventreport

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for event reports.
type UseCase interface {
	CreateEventReport(ctx context.Context, userID, eventID uuid.UUID, input CreateEventReportInput) (*EventReportResult, error)
}
