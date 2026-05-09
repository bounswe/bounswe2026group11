package profile

import (
	"context"
	"errors"
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
		Locale:                 p.Locale,
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

// GetPublicProfile returns the public-safe projection of another user's
// profile, enriched with equipment and showcase images.
func (s *Service) GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResult, error) {
	profileRecord, err := s.repo.GetPublicProfile(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeUserNotFound, "The requested user does not exist.")
		}
		return nil, err
	}

	equipment, err := s.repo.ListEquipment(ctx, userID)
	if err != nil {
		return nil, err
	}
	showcaseImages, err := s.repo.ListShowcaseImages(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &PublicProfileResult{
		UserID:                 profileRecord.UserID.String(),
		Username:               profileRecord.Username,
		DisplayName:            profileRecord.DisplayName,
		AvatarURL:              profileRecord.AvatarURL,
		Bio:                    profileRecord.Bio,
		FinalScore:             profileRecord.FinalScore,
		HostRatingCount:        profileRecord.HostRatingCount,
		ParticipantRatingCount: profileRecord.ParticipantRatingCount,
		Equipment:              toEquipmentItems(equipment),
		ShowcaseImages:         toShowcaseImageItems(showcaseImages),
	}, nil
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

// ListMyEquipment returns the authenticated user's equipment entries.
func (s *Service) ListMyEquipment(ctx context.Context, userID uuid.UUID) (*ListEquipmentResult, error) {
	items, err := s.repo.ListEquipment(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &ListEquipmentResult{Items: toEquipmentItems(items)}, nil
}

// CreateMyEquipment validates and persists one equipment item for the
// authenticated user.
func (s *Service) CreateMyEquipment(ctx context.Context, input CreateEquipmentInput) (*EquipmentItem, error) {
	validated, appErr := validateCreateEquipmentInput(input)
	if appErr != nil {
		return nil, appErr
	}

	var created *domain.ProfileEquipment
	if err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		created, err = s.repo.CreateEquipment(ctx, CreateEquipmentParams{
			UserID:      validated.UserID,
			Name:        validated.Name,
			Description: validated.Description,
			ImageURL:    validated.ImageURL,
		})
		return err
	}); err != nil {
		return nil, err
	}

	return toEquipmentItem(*created), nil
}

// UpdateMyEquipment updates one of the authenticated user's equipment entries.
func (s *Service) UpdateMyEquipment(ctx context.Context, input UpdateEquipmentInput) (*EquipmentItem, error) {
	validated, appErr := validateUpdateEquipmentInput(input)
	if appErr != nil {
		return nil, appErr
	}

	var updated *domain.ProfileEquipment
	if err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		existing, err := s.repo.GetEquipmentByID(ctx, validated.EquipmentID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeProfileEquipmentNotFound, "The requested equipment item does not exist.")
			}
			return err
		}
		if existing.UserID != validated.UserID {
			return domain.ForbiddenError(domain.ErrorCodeProfileMutationNotAllowed, "You can only modify your own profile resources.")
		}

		updated, err = s.repo.UpdateEquipment(ctx, UpdateEquipmentParams{
			EquipmentID: validated.EquipmentID,
			Name:        validated.Name,
			Description: validated.Description,
			ImageURL:    validated.ImageURL,
		})
		if err != nil && errors.Is(err, domain.ErrNotFound) {
			return domain.NotFoundError(domain.ErrorCodeProfileEquipmentNotFound, "The requested equipment item does not exist.")
		}
		return err
	}); err != nil {
		return nil, err
	}

	return toEquipmentItem(*updated), nil
}

// DeleteMyEquipment deletes one of the authenticated user's equipment entries.
func (s *Service) DeleteMyEquipment(ctx context.Context, userID, equipmentID uuid.UUID) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		existing, err := s.repo.GetEquipmentByID(ctx, equipmentID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeProfileEquipmentNotFound, "The requested equipment item does not exist.")
			}
			return err
		}
		if existing.UserID != userID {
			return domain.ForbiddenError(domain.ErrorCodeProfileMutationNotAllowed, "You can only modify your own profile resources.")
		}
		return s.repo.DeleteEquipment(ctx, equipmentID)
	})
}

// DeleteMyShowcaseImage deletes one of the authenticated user's showcase
// images.
func (s *Service) DeleteMyShowcaseImage(ctx context.Context, userID, showcaseImageID uuid.UUID) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		existing, err := s.repo.GetShowcaseImageByID(ctx, showcaseImageID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeProfileShowcaseImageNotFound, "The requested showcase image does not exist.")
			}
			return err
		}
		if existing.UserID != userID {
			return domain.ForbiddenError(domain.ErrorCodeProfileMutationNotAllowed, "You can only modify your own profile resources.")
		}
		return s.repo.DeleteShowcaseImage(ctx, showcaseImageID)
	})
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

func toEquipmentItems(items []domain.ProfileEquipment) []EquipmentItem {
	result := make([]EquipmentItem, len(items))
	for i, item := range items {
		result[i] = EquipmentItem{
			ID:          item.ID.String(),
			Name:        item.Name,
			Description: item.Description,
			ImageURL:    item.ImageURL,
		}
	}
	return result
}

func toEquipmentItem(item domain.ProfileEquipment) *EquipmentItem {
	return &EquipmentItem{
		ID:          item.ID.String(),
		Name:        item.Name,
		Description: item.Description,
		ImageURL:    item.ImageURL,
	}
}

func toShowcaseImageItems(items []domain.ProfileShowcaseImage) []ShowcaseImageItem {
	result := make([]ShowcaseImageItem, len(items))
	for i, item := range items {
		result[i] = ShowcaseImageItem{
			ID:       item.ID.String(),
			ImageURL: item.ImageURL,
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
			Locale:                 validated.Locale,
			DefaultLocationAddress: validated.DefaultLocationAddress,
			DefaultLocationLat:     validated.DefaultLocationLat,
			DefaultLocationLon:     validated.DefaultLocationLon,
			DisplayName:            validated.DisplayName,
			Bio:                    validated.Bio,
			AvatarURL:              validated.AvatarURL,
		})
	})
}
