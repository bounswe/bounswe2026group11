package eventreport

import (
	"context"
	"errors"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns event-report application behavior.
type Service struct {
	repo           Repository
	imageConfirmer ReportImageConfirmer
}

var _ UseCase = (*Service)(nil)

// NewService constructs an event-report service backed by its repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// SetReportImageConfirmer wires in the image-upload service.
func (s *Service) SetReportImageConfirmer(confirmer ReportImageConfirmer) {
	s.imageConfirmer = confirmer
}

// CreateEventReport creates a moderation report for an existing event.
func (s *Service) CreateEventReport(ctx context.Context, userID, eventID uuid.UUID, input CreateEventReportInput) (*EventReportResult, error) {
	input.Message = normalizeMessage(input.Message)
	if errs := validateMessage(input.Message); len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	reportContext, err := s.repo.GetEventReportContext(ctx, eventID)
	if err != nil {
		return nil, s.mapEventLookupError(err)
	}

	var imageURL *string
	if input.ImageConfirmToken != nil && *input.ImageConfirmToken != "" {
		if reportContext.Status != domain.EventStatusInProgress && reportContext.Status != domain.EventStatusCompleted {
			return nil, domain.ConflictError(domain.ErrorCodeEventReportImageNotAllowed, "Report images are allowed only while an event is in progress or completed.")
		}
		if s.imageConfirmer == nil {
			return nil, domain.ForbiddenError(domain.ErrorCodeEventReportImageNotAllowed, "Report image uploads are not available.")
		}
		confirmed, err := s.imageConfirmer.ConfirmEventReportImageUpload(ctx, userID, eventID, imageupload.ConfirmUploadInput{
			ConfirmToken: *input.ImageConfirmToken,
		})
		if err != nil {
			return nil, err
		}
		imageURL = &confirmed.BaseURL
	}

	created, err := s.repo.CreateEventReport(ctx, CreateEventReportParams{
		EventID:        eventID,
		ReporterUserID: userID,
		Category:       input.Category,
		Message:        input.Message,
		ImageURL:       imageURL,
	})
	if err != nil {
		return nil, err
	}

	return toEventReportResult(created), nil
}

func (s *Service) mapEventLookupError(err error) error {
	if errors.Is(err, domain.ErrNotFound) {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	return err
}
