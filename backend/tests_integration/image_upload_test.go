//go:build integration

package tests_integration

import (
	"context"
	"testing"
	"time"

	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	imageuploadapp "github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
)

type fakeStorage struct {
	existing map[string]bool
}

func (s *fakeStorage) PresignPutObject(_ context.Context, key, contentType, cacheControl string, expires time.Duration) (*imageuploadapp.PresignedRequest, error) {
	return &imageuploadapp.PresignedRequest{
		Method: "PUT",
		URL:    "https://upload.example/" + key,
		Headers: map[string]string{
			"Content-Type":  contentType,
			"Cache-Control": cacheControl,
		},
	}, nil
}

func (s *fakeStorage) ObjectExists(_ context.Context, key string) (bool, error) {
	return s.existing[key], nil
}

type fakeTokenManager struct {
	payload *imageuploadapp.ConfirmTokenPayload
}

func (m *fakeTokenManager) Sign(payload imageuploadapp.ConfirmTokenPayload, _ time.Duration) (string, error) {
	copyPayload := payload
	m.payload = &copyPayload
	return "confirm-token", nil
}

func (m *fakeTokenManager) Verify(_ string) (*imageuploadapp.ConfirmTokenPayload, error) {
	copyPayload := *m.payload
	return &copyPayload, nil
}

func newIntegrationImageUploadService(t *testing.T) (*imageuploadapp.Service, *fakeStorage, *fakeTokenManager) {
	t.Helper()

	pool := common.RequirePool(t)
	storage := &fakeStorage{existing: map[string]bool{}}
	tokens := &fakeTokenManager{}

	service := imageuploadapp.NewService(
		postgresrepo.NewProfileRepository(pool),
		postgresrepo.NewEventRepository(pool),
		storage,
		tokens,
		imageuploadapp.Settings{
			PresignTTL:      15 * time.Minute,
			UploadCacheCtrl: "public, max-age=604800, immutable",
			CDNBaseURL:      "https://sem-bucket.fra1.cdn.digitaloceanspaces.com",
		},
	)

	return service, storage, tokens
}

func TestConfirmProfileAvatarUploadPersistsURLAndVersion(t *testing.T) {
	pool := common.RequirePool(t)
	authRepo := postgresrepo.NewAuthRepository(pool)
	user := common.GivenUser(t, authRepo)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id = $1`, user.ID)
	})
	if err := authRepo.CreateProfile(context.Background(), user.ID); err != nil {
		t.Fatalf("CreateProfile() error = %v", err)
	}

	service, storage, tokens := newIntegrationImageUploadService(t)

	result, err := service.CreateProfileAvatarUpload(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("CreateProfileAvatarUpload() error = %v", err)
	}
	storage.existing[tokens.payload.OriginalKey] = true
	storage.existing[tokens.payload.SmallKey] = true

	if err := service.ConfirmProfileAvatarUpload(
		context.Background(),
		user.ID,
		imageuploadapp.ConfirmUploadInput{ConfirmToken: "confirm-token"},
	); err != nil {
		t.Fatalf("ConfirmProfileAvatarUpload() error = %v", err)
	}

	var (
		avatarURL     string
		avatarVersion int
	)
	if err := pool.QueryRow(
		context.Background(),
		`SELECT avatar_url, avatar_version FROM profile WHERE user_id = $1`,
		user.ID,
	).Scan(&avatarURL, &avatarVersion); err != nil {
		t.Fatalf("scan profile image state error = %v", err)
	}

	if avatarURL != result.BaseURL {
		t.Fatalf("expected avatar_url %q, got %q", result.BaseURL, avatarURL)
	}
	if avatarVersion != 1 {
		t.Fatalf("expected avatar_version 1, got %d", avatarVersion)
	}
}

func TestConfirmEventImageUploadPersistsURLAndVersionWithoutChangingEventVersionNo(t *testing.T) {
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	eventRef := common.GivenPublicEvent(t, harness.Service, host.ID)
	pool := common.RequirePool(t)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM event WHERE id = $1`, eventRef.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM app_user WHERE id = $1`, host.ID)
	})

	service, storage, tokens := newIntegrationImageUploadService(t)

	result, err := service.CreateEventImageUpload(context.Background(), host.ID, eventRef.ID)
	if err != nil {
		t.Fatalf("CreateEventImageUpload() error = %v", err)
	}
	storage.existing[tokens.payload.OriginalKey] = true
	storage.existing[tokens.payload.SmallKey] = true

	if err := service.ConfirmEventImageUpload(
		context.Background(),
		host.ID,
		eventRef.ID,
		imageuploadapp.ConfirmUploadInput{ConfirmToken: "confirm-token"},
	); err != nil {
		t.Fatalf("ConfirmEventImageUpload() error = %v", err)
	}

	var (
		imageURL     string
		imageVersion int
		versionNo    int
	)
	if err := pool.QueryRow(
		context.Background(),
		`SELECT image_url, image_version, version_no FROM event WHERE id = $1`,
		eventRef.ID,
	).Scan(&imageURL, &imageVersion, &versionNo); err != nil {
		t.Fatalf("scan event image state error = %v", err)
	}

	if imageURL != result.BaseURL {
		t.Fatalf("expected image_url %q, got %q", result.BaseURL, imageURL)
	}
	if imageVersion != 1 {
		t.Fatalf("expected image_version 1, got %d", imageVersion)
	}
	if versionNo != 0 {
		t.Fatalf("expected version_no to remain 0, got %d", versionNo)
	}
}
