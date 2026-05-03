package profile

import (
	"context"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns profile-specific application behavior.
type Service struct {
	repo           Repository
	unitOfWork     uow.UnitOfWork
	passwordHasher PasswordHasher
}

var _ UseCase = (*Service)(nil)

// NewService constructs a profile service backed by its own repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork, passwordHasher ...PasswordHasher) *Service {
	s := &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
	}
	if len(passwordHasher) > 0 {
		s.passwordHasher = passwordHasher[0]
	}
	return s
}

// GetMyProfile returns the combined app_user + profile data for the given user.
func (s *Service) GetMyProfile(ctx context.Context, userID uuid.UUID) (*GetProfileResult, error) {
	p, err := s.repo.GetProfile(ctx, userID)
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
		FinalScore:             p.FinalScore,
		HostScore: &HostScore{
			Score:       p.HostScore.Score,
			RatingCount: p.HostScore.RatingCount,
		},
		ParticipantScore: &ParticipantScore{
			Score:       p.ParticipantScore.Score,
			RatingCount: p.ParticipantScore.RatingCount,
		},
	}

	if p.BirthDate != nil {
		formatted := p.BirthDate.Format("2006-01-02")
		result.BirthDate = &formatted
	}

	return result, nil
}

// GetMyHostedEvents returns events created by the user.
func (s *Service) GetMyHostedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error) {
	events, err := s.repo.GetHostedEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toEventSummaries(events), nil
}

// GetMyUpcomingEvents returns events the user is still actively participating
// in with an APPROVED participation.
func (s *Service) GetMyUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error) {
	events, err := s.repo.GetUpcomingEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toEventSummaries(events), nil
}

// GetMyCompletedEvents returns completed events the user either finished as an
// APPROVED participant or left after the event had already started.
func (s *Service) GetMyCompletedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error) {
	events, err := s.repo.GetCompletedEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toEventSummaries(events), nil
}

// GetMyCanceledEvents returns events the user was part of (as host or participant)
// that have been CANCELED.
func (s *Service) GetMyCanceledEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error) {
	events, err := s.repo.GetCanceledEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	return toEventSummaries(events), nil
}

// SearchUsers returns lightweight user summaries for username picker UIs.
func (s *Service) SearchUsers(ctx context.Context, input UserSearchInput) (*UserSearchResult, error) {
	query := strings.TrimSpace(input.Query)
	if len(query) < 1 || len(query) > 32 {
		return nil, domain.ValidationError(map[string]string{"query": "must be between 1 and 32 characters"})
	}
	records, err := s.repo.SearchUsers(ctx, query, 10)
	if err != nil {
		return nil, err
	}
	items := make([]UserSearchItem, len(records))
	for i, record := range records {
		items[i] = UserSearchItem{
			ID:          record.ID.String(),
			Username:    record.Username,
			DisplayName: record.DisplayName,
			AvatarURL:   record.AvatarURL,
		}
	}
	return &UserSearchResult{Items: items}, nil
}

func toEventSummaries(events []domain.EventSummary) []EventSummary {
	result := make([]EventSummary, len(events))
	for i, e := range events {
		result[i] = EventSummary{
			ID:                e.ID.String(),
			Title:             e.Title,
			StartTime:         e.StartTime.Format("2006-01-02T15:04:05Z07:00"),
			EndTime:           e.EndTime.Format("2006-01-02T15:04:05Z07:00"),
			Status:            e.Status,
			PrivacyLevel:      e.PrivacyLevel,
			Category:          e.Category,
			ImageURL:          e.ImageURL,
			ParticipantsCount: e.ApprovedParticipantCount,
			LocationAddress:   e.LocationAddress,
		}
	}
	return result
}

// ChangePassword verifies the current password and replaces it with the new one.
func (s *Service) ChangePassword(ctx context.Context, input ChangePasswordInput) error {
	if err := validateChangePasswordInput(input); err != nil {
		return err
	}
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		currentHash, err := s.repo.GetPasswordHash(ctx, input.UserID)
		if err != nil {
			return err
		}
		if err := s.passwordHasher.Compare(currentHash, input.OldPassword); err != nil {
			return domain.AuthError(domain.ErrorCodePasswordMismatch, "Current password is incorrect.")
		}
		newHash, err := s.passwordHasher.Hash(input.NewPassword)
		if err != nil {
			return err
		}
		return s.repo.UpdatePasswordHash(ctx, input.UserID, newHash)
	})
}

// UpdateMyProfile validates and persists the editable profile fields.
func (s *Service) UpdateMyProfile(ctx context.Context, input UpdateProfileInput) error {
	validated, appErr := validateUpdateProfileInput(input)
	if appErr != nil {
		return appErr
	}

	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
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
	})
}
