package profile

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns profile-specific application behavior.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs a profile service backed by its own repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetMyProfile returns the combined app_user + profile data for the given user,
// including lists of events they created and attended.
func (s *Service) GetMyProfile(ctx context.Context, userID uuid.UUID) (*GetProfileResult, error) {
	p, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	createdEvents, err := s.repo.GetCreatedEvents(ctx, userID)
	if err != nil {
		return nil, err
	}

	attendedEvents, err := s.repo.GetAttendedEvents(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := &GetProfileResult{
		ID:                     p.ID.String(),
		Username:               p.Username,
		Email:                  p.Email,
		PhoneNumber:            p.PhoneNumber,
		Gender:                 p.Gender,
		EmailVerified:          p.EmailVerified,
		Status:                 p.Status,
		DefaultLocationAddress: p.DefaultLocationAddress,
		DefaultLocationLat:     p.DefaultLocationLat,
		DefaultLocationLon:     p.DefaultLocationLon,
		DisplayName:            p.DisplayName,
		Bio:                    p.Bio,
		AvatarURL:              p.AvatarURL,
		CreatedEvents:          toEventSummaries(createdEvents),
		AttendedEvents:         toEventSummaries(attendedEvents),
	}

	if p.BirthDate != nil {
		formatted := p.BirthDate.Format("2006-01-02")
		result.BirthDate = &formatted
	}

	return result, nil
}

func toEventSummaries(events []domain.EventSummary) []EventSummary {
	result := make([]EventSummary, len(events))
	for i, e := range events {
		result[i] = EventSummary{
			ID:        e.ID.String(),
			Title:     e.Title,
			StartTime: e.StartTime.Format("2006-01-02T15:04:05Z07:00"),
			EndTime:   e.EndTime.Format("2006-01-02T15:04:05Z07:00"),
			Status:    e.Status,
			Category:  e.Category,
			ImageURL:  e.ImageURL,
		}
	}
	return result
}

// UpdateMyProfile validates and persists the editable profile fields.
func (s *Service) UpdateMyProfile(ctx context.Context, input UpdateProfileInput) error {
	validated, appErr := validateUpdateProfileInput(input)
	if appErr != nil {
		return appErr
	}

	return s.repo.UpdateProfile(ctx, UpdateProfileParams{
		UserID:                 validated.UserID,
		PhoneNumber:            validated.PhoneNumber,
		Gender:                 validated.Gender,
		BirthDate:              validated.BirthDate,
		DefaultLocationAddress: validated.DefaultLocationAddress,
		DefaultLocationLat:     validated.DefaultLocationLat,
		DefaultLocationLon:     validated.DefaultLocationLon,
		DisplayName:            validated.DisplayName,
		Bio:                    validated.Bio,
		AvatarURL:              validated.AvatarURL,
	})
}
