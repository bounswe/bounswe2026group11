package imageupload

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeProfileRepo struct {
	version               int
	err                   error
	setErr                error
	lastSetUserID         uuid.UUID
	lastExpectedVersion   int
	lastNextVersion       int
	lastBaseURL           string
	lastUpdatedAt         time.Time
	setResult             bool
	getAvatarVersionCalls int
}

func (r *fakeProfileRepo) GetAvatarVersion(_ context.Context, _ uuid.UUID) (int, error) {
	r.getAvatarVersionCalls++
	if r.err != nil {
		return 0, r.err
	}
	return r.version, nil
}

func (r *fakeProfileRepo) SetAvatarIfVersion(
	_ context.Context,
	userID uuid.UUID,
	expectedVersion, nextVersion int,
	baseURL string,
	updatedAt time.Time,
) (bool, error) {
	r.lastSetUserID = userID
	r.lastExpectedVersion = expectedVersion
	r.lastNextVersion = nextVersion
	r.lastBaseURL = baseURL
	r.lastUpdatedAt = updatedAt
	if r.setErr != nil {
		return false, r.setErr
	}
	return r.setResult, nil
}

type fakeEventRepo struct {
	state             *EventImageState
	stateErr          error
	setErr            error
	setResult         bool
	lastSetEventID    uuid.UUID
	lastExpectedVer   int
	lastNextVer       int
	lastSetBaseURL    string
	lastSetUpdatedAt  time.Time
	getStateCallCount int
}

func (r *fakeEventRepo) GetEventImageState(_ context.Context, _ uuid.UUID) (*EventImageState, error) {
	r.getStateCallCount++
	if r.stateErr != nil {
		return nil, r.stateErr
	}
	return r.state, nil
}

func (r *fakeEventRepo) SetEventImageIfVersion(
	_ context.Context,
	eventID uuid.UUID,
	expectedVersion, nextVersion int,
	baseURL string,
	updatedAt time.Time,
) (bool, error) {
	r.lastSetEventID = eventID
	r.lastExpectedVer = expectedVersion
	r.lastNextVer = nextVersion
	r.lastSetBaseURL = baseURL
	r.lastSetUpdatedAt = updatedAt
	if r.setErr != nil {
		return false, r.setErr
	}
	return r.setResult, nil
}

type fakeStorage struct {
	presignedKeys []string
	existingKeys  map[string]bool
	err           error
}

func (s *fakeStorage) PresignPutObject(_ context.Context, key, contentType, cacheControl string, expires time.Duration) (*PresignedRequest, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.presignedKeys = append(s.presignedKeys, key)
	return &PresignedRequest{
		Method: "PUT",
		URL:    "https://upload.example/" + key,
		Headers: map[string]string{
			"Content-Type":  contentType,
			"Cache-Control": cacheControl,
			"x-amz-acl":     "public-read",
		},
	}, nil
}

func (s *fakeStorage) ObjectExists(_ context.Context, key string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	return s.existingKeys[key], nil
}

type fakeTokenManager struct {
	payload   *ConfirmTokenPayload
	signErr   error
	verifyErr error
}

func (m *fakeTokenManager) Sign(payload ConfirmTokenPayload, _ time.Duration) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	copyPayload := payload
	m.payload = &copyPayload
	return "confirm-token", nil
}

func (m *fakeTokenManager) Verify(_ string) (*ConfirmTokenPayload, error) {
	if m.verifyErr != nil {
		return nil, m.verifyErr
	}
	if m.payload == nil {
		return nil, errors.New("missing payload")
	}
	copyPayload := *m.payload
	return &copyPayload, nil
}

func newServiceForTests() (*Service, *fakeProfileRepo, *fakeEventRepo, *fakeStorage, *fakeTokenManager) {
	profileRepo := &fakeProfileRepo{version: 2, setResult: true}
	eventID := uuid.New()
	eventRepo := &fakeEventRepo{
		state: &EventImageState{
			EventID:        eventID,
			HostID:         uuid.New(),
			CurrentVersion: 3,
		},
		setResult: true,
	}
	storage := &fakeStorage{existingKeys: map[string]bool{}}
	tokens := &fakeTokenManager{}

	service := NewService(profileRepo, eventRepo, storage, tokens, Settings{
		PresignTTL:      15 * time.Minute,
		UploadCacheCtrl: "public, max-age=604800, immutable",
		CDNBaseURL:      "https://sem-bucket.fra1.cdn.digitaloceanspaces.com",
	})
	service.now = func() time.Time {
		return time.Date(2026, time.March, 31, 12, 0, 0, 0, time.UTC)
	}

	return service, profileRepo, eventRepo, storage, tokens
}

func TestCreateProfileAvatarUploadBuildsVersionedKeysAndBaseURL(t *testing.T) {
	// given
	svc, _, _, storage, tokens := newServiceForTests()
	userID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	// when
	result, err := svc.CreateProfileAvatarUpload(context.Background(), userID)

	// then
	if err != nil {
		t.Fatalf("CreateProfileAvatarUpload() error = %v", err)
	}
	if result.Version != 3 {
		t.Fatalf("expected version 3, got %d", result.Version)
	}
	expectedPrefix := "profiles/" + userID.String() + "/avatar/v3-"
	if len(storage.presignedKeys) != 2 {
		t.Fatalf("expected 2 presigned keys, got %d", len(storage.presignedKeys))
	}
	if len(tokens.payload.OriginalKey) == 0 || len(tokens.payload.SmallKey) == 0 {
		t.Fatalf("expected token payload keys to be set, got %+v", tokens.payload)
	}
	if tokens.payload.OriginalKey[:len(expectedPrefix)] != expectedPrefix {
		t.Fatalf("expected original key prefix %q, got %q", expectedPrefix, tokens.payload.OriginalKey)
	}
	if got, want := tokens.payload.SmallKey, tokens.payload.OriginalKey+"-small"; got != want {
		t.Fatalf("expected small key %q, got %q", want, got)
	}
	if got, want := result.BaseURL, "https://sem-bucket.fra1.cdn.digitaloceanspaces.com/"+tokens.payload.OriginalKey; got != want {
		t.Fatalf("expected base URL %q, got %q", want, got)
	}
}

func TestConfirmProfileAvatarUploadUpdatesWhenObjectsExist(t *testing.T) {
	// given
	svc, profileRepo, _, storage, tokens := newServiceForTests()
	userID := uuid.New()
	_, err := svc.CreateProfileAvatarUpload(context.Background(), userID)
	if err != nil {
		t.Fatalf("CreateProfileAvatarUpload() error = %v", err)
	}
	storage.existingKeys[tokens.payload.OriginalKey] = true
	storage.existingKeys[tokens.payload.SmallKey] = true

	// when
	err = svc.ConfirmProfileAvatarUpload(context.Background(), userID, ConfirmUploadInput{ConfirmToken: "confirm-token"})

	// then
	if err != nil {
		t.Fatalf("ConfirmProfileAvatarUpload() error = %v", err)
	}
	if profileRepo.lastExpectedVersion != 2 || profileRepo.lastNextVersion != 3 {
		t.Fatalf("expected version transition 2 -> 3, got %d -> %d", profileRepo.lastExpectedVersion, profileRepo.lastNextVersion)
	}
	if profileRepo.lastBaseURL != tokens.payload.BaseURL {
		t.Fatalf("expected base URL %q, got %q", tokens.payload.BaseURL, profileRepo.lastBaseURL)
	}
}

func TestConfirmProfileAvatarUploadRejectsIncompleteUpload(t *testing.T) {
	// given
	svc, _, _, storage, tokens := newServiceForTests()
	userID := uuid.New()
	_, err := svc.CreateProfileAvatarUpload(context.Background(), userID)
	if err != nil {
		t.Fatalf("CreateProfileAvatarUpload() error = %v", err)
	}
	storage.existingKeys[tokens.payload.OriginalKey] = true

	// when
	err = svc.ConfirmProfileAvatarUpload(context.Background(), userID, ConfirmUploadInput{ConfirmToken: "confirm-token"})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeImageUploadIncomplete {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeImageUploadIncomplete, appErr.Code)
	}
}

func TestConfirmProfileAvatarUploadRejectsStaleVersion(t *testing.T) {
	// given
	svc, profileRepo, _, storage, tokens := newServiceForTests()
	userID := uuid.New()
	_, err := svc.CreateProfileAvatarUpload(context.Background(), userID)
	if err != nil {
		t.Fatalf("CreateProfileAvatarUpload() error = %v", err)
	}
	profileRepo.version = 3
	storage.existingKeys[tokens.payload.OriginalKey] = true
	storage.existingKeys[tokens.payload.SmallKey] = true

	// when
	err = svc.ConfirmProfileAvatarUpload(context.Background(), userID, ConfirmUploadInput{ConfirmToken: "confirm-token"})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeImageUploadVersionConflict {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeImageUploadVersionConflict, appErr.Code)
	}
}

func TestCreateEventImageUploadRejectsNonHost(t *testing.T) {
	// given
	svc, _, eventRepo, _, _ := newServiceForTests()

	// when
	_, err := svc.CreateEventImageUpload(context.Background(), uuid.New(), eventRepo.state.EventID)

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeImageUploadNotAllowed {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeImageUploadNotAllowed, appErr.Code)
	}
}

func TestConfirmEventImageUploadRejectsInvalidToken(t *testing.T) {
	// given
	svc, _, _, _, tokens := newServiceForTests()
	tokens.verifyErr = errors.New("expired")

	// when
	err := svc.ConfirmEventImageUpload(context.Background(), uuid.New(), uuid.New(), ConfirmUploadInput{ConfirmToken: "expired"})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeImageUploadTokenInvalid {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeImageUploadTokenInvalid, appErr.Code)
	}
}
