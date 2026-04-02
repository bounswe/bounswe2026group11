package imageupload

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns image-upload application behavior for profile avatars and event images.
type Service struct {
	profileRepo ProfileRepository
	eventRepo   EventRepository
	storage     Storage
	tokens      TokenManager
	settings    Settings
	now         func() time.Time
}

var _ UseCase = (*Service)(nil)

// NewService constructs an image upload service.
func NewService(
	profileRepo ProfileRepository,
	eventRepo EventRepository,
	storage Storage,
	tokens TokenManager,
	settings Settings,
) *Service {
	return &Service{
		profileRepo: profileRepo,
		eventRepo:   eventRepo,
		storage:     storage,
		tokens:      tokens,
		settings: Settings{
			PresignTTL:      settings.PresignTTL,
			UploadCacheCtrl: strings.TrimSpace(settings.UploadCacheCtrl),
			CDNBaseURL:      strings.TrimRight(strings.TrimSpace(settings.CDNBaseURL), "/"),
		},
		now: time.Now,
	}
}

// CreateProfileAvatarUpload prepares a versioned direct-upload flow for the authenticated user's avatar.
func (s *Service) CreateProfileAvatarUpload(ctx context.Context, userID uuid.UUID) (*CreateUploadResult, error) {
	currentVersion, err := s.profileRepo.GetAvatarVersion(ctx, userID)
	if err != nil {
		return nil, err
	}
	uploadID := uuid.NewString()

	return s.createUpload(ctx, uploadDescriptor{
		Resource:     ResourceProfileAvatar,
		OwnerUserID:  userID,
		NextVersion:  currentVersion + 1,
		OriginalKey:  fmt.Sprintf("profiles/%s/avatar/v%d-%s", userID, currentVersion+1, uploadID),
		UploadID:     uploadID,
		CurrentEvent: nil,
	})
}

// ConfirmProfileAvatarUpload verifies the uploaded objects and atomically updates the profile URL/version.
func (s *Service) ConfirmProfileAvatarUpload(ctx context.Context, userID uuid.UUID, input ConfirmUploadInput) error {
	payload, err := s.verifyConfirmToken(input, ResourceProfileAvatar)
	if err != nil {
		return err
	}
	if payload.OwnerUserID != userID || payload.EventID != nil {
		return invalidConfirmTokenError()
	}

	currentVersion, err := s.profileRepo.GetAvatarVersion(ctx, userID)
	if err != nil {
		return err
	}
	if currentVersion != payload.Version-1 {
		return domain.ConflictError(
			domain.ErrorCodeImageUploadVersionConflict,
			"A newer avatar image upload has already been confirmed.",
		)
	}

	if err := s.ensureUploadedObjectsExist(ctx, payload); err != nil {
		return err
	}

	updated, err := s.profileRepo.SetAvatarIfVersion(
		ctx,
		userID,
		currentVersion,
		payload.Version,
		payload.BaseURL,
		s.now().UTC(),
	)
	if err != nil {
		return err
	}
	if !updated {
		return domain.ConflictError(
			domain.ErrorCodeImageUploadVersionConflict,
			"A newer avatar image upload has already been confirmed.",
		)
	}

	return nil
}

// CreateEventImageUpload prepares a versioned direct-upload flow for an event cover image.
func (s *Service) CreateEventImageUpload(ctx context.Context, userID, eventID uuid.UUID) (*CreateUploadResult, error) {
	state, err := s.eventRepo.GetEventImageState(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}
	if state.HostID != userID {
		return nil, domain.ForbiddenError(
			domain.ErrorCodeImageUploadNotAllowed,
			"Only the event host can upload the event image.",
		)
	}
	uploadID := uuid.NewString()

	return s.createUpload(ctx, uploadDescriptor{
		Resource:     ResourceEventImage,
		OwnerUserID:  userID,
		NextVersion:  state.CurrentVersion + 1,
		OriginalKey:  fmt.Sprintf("events/%s/cover/v%d-%s", eventID, state.CurrentVersion+1, uploadID),
		UploadID:     uploadID,
		CurrentEvent: &eventID,
	})
}

// ConfirmEventImageUpload verifies the uploaded objects and atomically updates the event URL/version.
func (s *Service) ConfirmEventImageUpload(ctx context.Context, userID, eventID uuid.UUID, input ConfirmUploadInput) error {
	payload, err := s.verifyConfirmToken(input, ResourceEventImage)
	if err != nil {
		return err
	}
	if payload.OwnerUserID != userID || payload.EventID == nil || *payload.EventID != eventID {
		return invalidConfirmTokenError()
	}

	state, err := s.eventRepo.GetEventImageState(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return err
	}
	if state.HostID != userID {
		return domain.ForbiddenError(
			domain.ErrorCodeImageUploadNotAllowed,
			"Only the event host can upload the event image.",
		)
	}
	if state.CurrentVersion != payload.Version-1 {
		return domain.ConflictError(
			domain.ErrorCodeImageUploadVersionConflict,
			"A newer event image upload has already been confirmed.",
		)
	}

	if err := s.ensureUploadedObjectsExist(ctx, payload); err != nil {
		return err
	}

	updated, err := s.eventRepo.SetEventImageIfVersion(
		ctx,
		eventID,
		state.CurrentVersion,
		payload.Version,
		payload.BaseURL,
		s.now().UTC(),
	)
	if err != nil {
		return err
	}
	if !updated {
		return domain.ConflictError(
			domain.ErrorCodeImageUploadVersionConflict,
			"A newer event image upload has already been confirmed.",
		)
	}

	return nil
}

type uploadDescriptor struct {
	Resource     string
	OwnerUserID  uuid.UUID
	NextVersion  int
	OriginalKey  string
	UploadID     string
	CurrentEvent *uuid.UUID
}

func (s *Service) createUpload(ctx context.Context, desc uploadDescriptor) (*CreateUploadResult, error) {
	baseURL := s.settings.CDNBaseURL + "/" + desc.OriginalKey
	smallKey := desc.OriginalKey + "-small"

	originalUpload, err := s.storage.PresignPutObject(
		ctx,
		desc.OriginalKey,
		JPEGContentType,
		s.settings.UploadCacheCtrl,
		s.settings.PresignTTL,
	)
	if err != nil {
		return nil, err
	}

	smallUpload, err := s.storage.PresignPutObject(
		ctx,
		smallKey,
		JPEGContentType,
		s.settings.UploadCacheCtrl,
		s.settings.PresignTTL,
	)
	if err != nil {
		return nil, err
	}

	token, err := s.tokens.Sign(ConfirmTokenPayload{
		Resource:    desc.Resource,
		OwnerUserID: desc.OwnerUserID,
		EventID:     desc.CurrentEvent,
		Version:     desc.NextVersion,
		UploadID:    desc.UploadID,
		BaseURL:     baseURL,
		OriginalKey: desc.OriginalKey,
		SmallKey:    smallKey,
		ExpiresAt:   s.now().UTC().Add(s.settings.PresignTTL),
	}, s.settings.PresignTTL)
	if err != nil {
		return nil, err
	}

	return &CreateUploadResult{
		BaseURL:      baseURL,
		Version:      desc.NextVersion,
		ConfirmToken: token,
		Uploads: []PresignedUpload{
			{
				Variant: VariantOriginal,
				Method:  originalUpload.Method,
				URL:     originalUpload.URL,
				Headers: originalUpload.Headers,
			},
			{
				Variant: VariantSmall,
				Method:  smallUpload.Method,
				URL:     smallUpload.URL,
				Headers: smallUpload.Headers,
			},
		},
	}, nil
}

func (s *Service) verifyConfirmToken(input ConfirmUploadInput, expectedResource string) (*ConfirmTokenPayload, error) {
	token := strings.TrimSpace(input.ConfirmToken)
	if token == "" {
		return nil, invalidConfirmTokenError()
	}

	payload, err := s.tokens.Verify(token)
	if err != nil {
		return nil, invalidConfirmTokenError()
	}
	if payload.Resource != expectedResource {
		return nil, invalidConfirmTokenError()
	}

	return payload, nil
}

func (s *Service) ensureUploadedObjectsExist(ctx context.Context, payload *ConfirmTokenPayload) error {
	originalExists, err := s.storage.ObjectExists(ctx, payload.OriginalKey)
	if err != nil {
		return err
	}
	smallExists, err := s.storage.ObjectExists(ctx, payload.SmallKey)
	if err != nil {
		return err
	}
	if originalExists && smallExists {
		return nil
	}

	return domain.ConflictError(
		domain.ErrorCodeImageUploadIncomplete,
		"Upload is incomplete. Upload both ORIGINAL and SMALL images before confirming.",
	)
}

func invalidConfirmTokenError() *domain.AppError {
	return domain.BadRequestError(
		domain.ErrorCodeImageUploadTokenInvalid,
		"The confirm token is invalid or expired.",
	)
}
