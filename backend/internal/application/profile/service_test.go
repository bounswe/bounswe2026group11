package profile

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// --- fakes ---

type fakeUnitOfWork struct{}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

type fakeProfileRepo struct {
	profile                    *domain.UserProfile
	publicProfile              *domain.PublicUserProfile
	profileErr                 error
	passwordHash               string
	hostedEvents               []domain.EventSummary
	upcomingEvents             []domain.EventSummary
	completedEvents            []domain.EventSummary
	canceledEvents             []domain.EventSummary
	searchUsers                []UserSearchRecord
	equipment                  []domain.ProfileEquipment
	equipmentRecord            *domain.ProfileEquipment
	showcaseImages             []domain.ProfileShowcaseImage
	showcaseRecord             *domain.ProfileShowcaseImage
	eventsErr                  error
	equipmentErr               error
	lastCreateEquipmentParams  CreateEquipmentParams
	lastUpdateEquipmentParams  UpdateEquipmentParams
	lastDeletedEquipmentID     uuid.UUID
	lastDeletedShowcaseImageID uuid.UUID
}

func (r *fakeProfileRepo) GetProfile(_ context.Context, _ uuid.UUID) (*domain.UserProfile, error) {
	return r.profile, r.profileErr
}

func (r *fakeProfileRepo) UpdateProfile(_ context.Context, _ UpdateProfileParams) error {
	return nil
}

func (r *fakeProfileRepo) GetPublicProfile(_ context.Context, _ uuid.UUID) (*domain.PublicUserProfile, error) {
	return r.publicProfile, r.profileErr
}

func (r *fakeProfileRepo) GetHostedEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.hostedEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetUpcomingEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.upcomingEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetCompletedEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.completedEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetCanceledEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.canceledEvents, r.eventsErr
}

func (r *fakeProfileRepo) SearchUsers(_ context.Context, _ string, _ int) ([]UserSearchRecord, error) {
	return r.searchUsers, r.eventsErr
}

func (r *fakeProfileRepo) ListEquipment(_ context.Context, _ uuid.UUID) ([]domain.ProfileEquipment, error) {
	return r.equipment, r.equipmentErr
}

func (r *fakeProfileRepo) GetEquipmentByID(_ context.Context, _ uuid.UUID) (*domain.ProfileEquipment, error) {
	if r.equipmentErr != nil {
		return nil, r.equipmentErr
	}
	if r.equipmentRecord == nil {
		return nil, domain.ErrNotFound
	}
	return r.equipmentRecord, nil
}

func (r *fakeProfileRepo) CreateEquipment(_ context.Context, params CreateEquipmentParams) (*domain.ProfileEquipment, error) {
	r.lastCreateEquipmentParams = params
	if r.equipmentErr != nil {
		return nil, r.equipmentErr
	}
	item := &domain.ProfileEquipment{
		ID:          uuid.New(),
		UserID:      params.UserID,
		Name:        params.Name,
		Description: params.Description,
		ImageURL:    params.ImageURL,
	}
	r.equipmentRecord = item
	return item, nil
}

func (r *fakeProfileRepo) UpdateEquipment(_ context.Context, params UpdateEquipmentParams) (*domain.ProfileEquipment, error) {
	r.lastUpdateEquipmentParams = params
	if r.equipmentErr != nil {
		return nil, r.equipmentErr
	}
	if r.equipmentRecord == nil {
		return nil, domain.ErrNotFound
	}
	if params.Name != nil {
		r.equipmentRecord.Name = *params.Name
	}
	if params.Description != nil {
		r.equipmentRecord.Description = params.Description
	}
	if params.ImageURL != nil {
		r.equipmentRecord.ImageURL = params.ImageURL
	}
	return r.equipmentRecord, nil
}

func (r *fakeProfileRepo) DeleteEquipment(_ context.Context, equipmentID uuid.UUID) error {
	r.lastDeletedEquipmentID = equipmentID
	return r.equipmentErr
}

func (r *fakeProfileRepo) ListShowcaseImages(_ context.Context, _ uuid.UUID) ([]domain.ProfileShowcaseImage, error) {
	return r.showcaseImages, r.equipmentErr
}

func (r *fakeProfileRepo) GetShowcaseImageByID(_ context.Context, _ uuid.UUID) (*domain.ProfileShowcaseImage, error) {
	if r.equipmentErr != nil {
		return nil, r.equipmentErr
	}
	if r.showcaseRecord == nil {
		return nil, domain.ErrNotFound
	}
	return r.showcaseRecord, nil
}

func (r *fakeProfileRepo) CreateShowcaseImage(_ context.Context, userID uuid.UUID, imageURL string) (*domain.ProfileShowcaseImage, error) {
	if r.equipmentErr != nil {
		return nil, r.equipmentErr
	}
	item := &domain.ProfileShowcaseImage{
		ID:       uuid.New(),
		UserID:   userID,
		ImageURL: imageURL,
	}
	r.showcaseRecord = item
	return item, nil
}

func (r *fakeProfileRepo) DeleteShowcaseImage(_ context.Context, showcaseImageID uuid.UUID) error {
	r.lastDeletedShowcaseImageID = showcaseImageID
	return r.equipmentErr
}

func (r *fakeProfileRepo) GetPasswordHash(_ context.Context, _ uuid.UUID) (string, error) {
	return r.passwordHash, r.profileErr
}

func (r *fakeProfileRepo) UpdatePasswordHash(_ context.Context, _ uuid.UUID, _ string) error {
	return r.profileErr
}

func (r *fakeProfileRepo) GetLocale(_ context.Context, _ uuid.UUID) (string, error) {
	if r.profile != nil {
		return r.profile.Locale, nil
	}
	return "", r.profileErr
}

func newService(repo *fakeProfileRepo) *Service {
	return NewService(repo, &fakeUnitOfWork{})
}

// --- GetMyProfile tests ---

func TestGetMyProfileMapsHostScore(t *testing.T) {
	score := 4.5
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:         uuid.New(),
			Username:   "testuser",
			Email:      "test@example.com",
			Status:     domain.UserStatusActive,
			FinalScore: &score,
			HostScore: domain.HostScore{
				Score:       &score,
				RatingCount: 8,
			},
			ParticipantScore: domain.ParticipantScore{
				Score:       nil,
				RatingCount: 0,
			},
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.FinalScore == nil || *result.FinalScore != score {
		t.Fatalf("expected final_score=%v, got %v", score, result.FinalScore)
	}
	if result.HostScore == nil {
		t.Fatal("expected host_score to be present")
	}
	if result.HostScore.Score == nil || *result.HostScore.Score != score {
		t.Fatalf("expected host_score.score=%v, got %v", score, result.HostScore.Score)
	}
	if result.HostScore.RatingCount != 8 {
		t.Fatalf("expected host_score.rating_count=8, got %d", result.HostScore.RatingCount)
	}
}

func TestGetMyProfileMapsParticipantScore(t *testing.T) {
	participantScore := 3.9
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:       uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
			Status:   domain.UserStatusActive,
			ParticipantScore: domain.ParticipantScore{
				Score:       &participantScore,
				RatingCount: 12,
			},
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.ParticipantScore == nil {
		t.Fatal("expected participant_score to be present")
	}
	if result.ParticipantScore.Score == nil || *result.ParticipantScore.Score != participantScore {
		t.Fatalf("expected participant_score.score=%v, got %v", participantScore, result.ParticipantScore.Score)
	}
	if result.ParticipantScore.RatingCount != 12 {
		t.Fatalf("expected participant_score.rating_count=12, got %d", result.ParticipantScore.RatingCount)
	}
}

func TestGetMyProfileNullScoresForNewUser(t *testing.T) {
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:       uuid.New(),
			Username: "newuser",
			Email:    "new@example.com",
			Status:   domain.UserStatusActive,
			// zero-value HostScore and ParticipantScore (no row in user_score)
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.FinalScore != nil {
		t.Fatalf("expected final_score=nil for new user, got %v", result.FinalScore)
	}
	if result.HostScore == nil || result.HostScore.Score != nil {
		t.Fatalf("expected host_score.score=nil for new user")
	}
	if result.HostScore.RatingCount != 0 {
		t.Fatalf("expected host_score.rating_count=0, got %d", result.HostScore.RatingCount)
	}
	if result.ParticipantScore == nil || result.ParticipantScore.Score != nil {
		t.Fatalf("expected participant_score.score=nil for new user")
	}
	if result.ParticipantScore.RatingCount != 0 {
		t.Fatalf("expected participant_score.rating_count=0, got %d", result.ParticipantScore.RatingCount)
	}
}

func TestGetMyProfilePropagatesRepoError(t *testing.T) {
	repo := &fakeProfileRepo{profileErr: errors.New("db error")}

	_, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetPublicProfileIncludesEquipmentAndShowcase(t *testing.T) {
	repo := &fakeProfileRepo{
		publicProfile: &domain.PublicUserProfile{
			UserID:                 uuid.New(),
			Username:               "runner",
			HostRatingCount:        3,
			ParticipantRatingCount: 5,
		},
		equipment: []domain.ProfileEquipment{
			{ID: uuid.New(), UserID: uuid.New(), Name: "Shoes"},
		},
		showcaseImages: []domain.ProfileShowcaseImage{
			{ID: uuid.New(), UserID: uuid.New(), ImageURL: "https://cdn.example/showcase.jpg"},
		},
	}

	result, err := newService(repo).GetPublicProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetPublicProfile() error = %v", err)
	}
	if len(result.Equipment) != 1 {
		t.Fatalf("expected 1 equipment item, got %d", len(result.Equipment))
	}
	if len(result.ShowcaseImages) != 1 {
		t.Fatalf("expected 1 showcase image, got %d", len(result.ShowcaseImages))
	}
	if result.HostRatingCount != 3 || result.ParticipantRatingCount != 5 {
		t.Fatalf("unexpected rating counts: %+v", result)
	}
}

func TestGetPublicProfileMapsUserNotFound(t *testing.T) {
	repo := &fakeProfileRepo{profileErr: domain.ErrNotFound}

	_, err := newService(repo).GetPublicProfile(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeUserNotFound {
		t.Fatalf("expected user_not_found AppError, got %v", err)
	}
}

// --- event summary privacy_level tests ---

func TestGetMyHostedEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		hostedEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PUBLIC"},
			{ID: uuid.New(), Title: "T2", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PROTECTED"},
		},
	}

	events, err := newService(repo).GetMyHostedEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyHostedEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PUBLIC" {
		t.Fatalf("expected PUBLIC, got %q", events[0].PrivacyLevel)
	}
	if events[1].PrivacyLevel != "PROTECTED" {
		t.Fatalf("expected PROTECTED, got %q", events[1].PrivacyLevel)
	}
}

func TestGetMyUpcomingEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		upcomingEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PROTECTED"},
		},
	}

	events, err := newService(repo).GetMyUpcomingEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyUpcomingEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PROTECTED" {
		t.Fatalf("expected PROTECTED, got %q", events[0].PrivacyLevel)
	}
}

func TestGetMyCanceledEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		canceledEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "CANCELED", PrivacyLevel: "PRIVATE"},
		},
	}

	events, err := newService(repo).GetMyCanceledEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyCanceledEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PRIVATE" {
		t.Fatalf("expected PRIVATE, got %q", events[0].PrivacyLevel)
	}
}

func TestCreateMyEquipmentNormalizesOptionalFields(t *testing.T) {
	repo := &fakeProfileRepo{}
	svc := newService(repo)

	description := "  lightweight  "
	imageURL := "   "
	item, err := svc.CreateMyEquipment(context.Background(), CreateEquipmentInput{
		UserID:      uuid.New(),
		Name:        "  Trail Shoes ",
		Description: &description,
		ImageURL:    &imageURL,
	})
	if err != nil {
		t.Fatalf("CreateMyEquipment() error = %v", err)
	}
	if item.Name != "Trail Shoes" {
		t.Fatalf("expected trimmed name, got %q", item.Name)
	}
	if repo.lastCreateEquipmentParams.Description == nil || *repo.lastCreateEquipmentParams.Description != "lightweight" {
		t.Fatalf("expected trimmed description, got %+v", repo.lastCreateEquipmentParams.Description)
	}
	if repo.lastCreateEquipmentParams.ImageURL != nil {
		t.Fatalf("expected blank image_url to clear, got %+v", repo.lastCreateEquipmentParams.ImageURL)
	}
}

func TestUpdateMyEquipmentRejectsForeignOwner(t *testing.T) {
	ownerID := uuid.New()
	callerID := uuid.New()
	repo := &fakeProfileRepo{
		equipmentRecord: &domain.ProfileEquipment{
			ID:     uuid.New(),
			UserID: ownerID,
			Name:   "Tent",
		},
	}
	svc := newService(repo)

	name := "New Tent"
	_, err := svc.UpdateMyEquipment(context.Background(), UpdateEquipmentInput{
		UserID:      callerID,
		EquipmentID: repo.equipmentRecord.ID,
		Name:        &name,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeProfileMutationNotAllowed {
		t.Fatalf("expected profile_mutation_not_allowed, got %v", err)
	}
}

func TestDeleteMyShowcaseImageRejectsForeignOwner(t *testing.T) {
	repo := &fakeProfileRepo{
		showcaseRecord: &domain.ProfileShowcaseImage{
			ID:       uuid.New(),
			UserID:   uuid.New(),
			ImageURL: "https://cdn.example/showcase.jpg",
		},
	}
	svc := newService(repo)

	err := svc.DeleteMyShowcaseImage(context.Background(), uuid.New(), repo.showcaseRecord.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodeProfileMutationNotAllowed {
		t.Fatalf("expected profile_mutation_not_allowed, got %v", err)
	}
}

// --- ChangePassword tests ---

type fakeHasher struct {
	compareErr error
	hashErr    error
}

func (h fakeHasher) Hash(_ string) (string, error) {
	if h.hashErr != nil {
		return "", h.hashErr
	}
	return "hashed", nil
}

func (h fakeHasher) Compare(_, _ string) error { return h.compareErr }

func newServiceWithHasher(repo *fakeProfileRepo, ph PasswordHasher) *Service {
	return NewService(repo, &fakeUnitOfWork{}, ph)
}

func TestChangePassword_Success(t *testing.T) {
	repo := &fakeProfileRepo{passwordHash: "$2a$10$stored"}
	svc := newServiceWithHasher(repo, fakeHasher{})

	err := svc.ChangePassword(context.Background(), ChangePasswordInput{
		UserID:      uuid.New(),
		OldPassword: "oldpass123",
		NewPassword: "newpass456",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestChangePassword_WrongOldPassword(t *testing.T) {
	repo := &fakeProfileRepo{passwordHash: "$2a$10$stored"}
	svc := newServiceWithHasher(repo, fakeHasher{compareErr: errors.New("mismatch")})

	err := svc.ChangePassword(context.Background(), ChangePasswordInput{
		UserID:      uuid.New(),
		OldPassword: "wrongpass",
		NewPassword: "newpass456",
	})
	if err == nil {
		t.Fatal("expected error for wrong old password")
	}
	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.ErrorCodePasswordMismatch {
		t.Fatalf("expected password_mismatch AppError, got %v", err)
	}
}

func TestChangePassword_ValidationFailsShortNew(t *testing.T) {
	repo := &fakeProfileRepo{}
	svc := newServiceWithHasher(repo, fakeHasher{})

	err := svc.ChangePassword(context.Background(), ChangePasswordInput{
		UserID:      uuid.New(),
		OldPassword: "oldpass123",
		NewPassword: "short",
	})
	if err == nil {
		t.Fatal("expected validation error for short new password")
	}
}

func TestChangePassword_SamePassword(t *testing.T) {
	repo := &fakeProfileRepo{}
	svc := newServiceWithHasher(repo, fakeHasher{})

	err := svc.ChangePassword(context.Background(), ChangePasswordInput{
		UserID:      uuid.New(),
		OldPassword: "samepass123",
		NewPassword: "samepass123",
	})
	if err == nil {
		t.Fatal("expected validation error when new == old password")
	}
}
