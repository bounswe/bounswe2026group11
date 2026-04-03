package favorite_location

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeRepository struct {
	listResult   []domain.FavoriteLocation
	createResult *domain.FavoriteLocation
	getResult    *domain.FavoriteLocation
	updateResult *domain.FavoriteLocation
	err          error

	lastCreateParams CreateFavoriteLocationParams
	lastUpdateParams UpdateFavoriteLocationParams
	lastDeleteUserID uuid.UUID
	lastDeleteID     uuid.UUID
}

func (r *fakeRepository) ListByUserID(_ context.Context, _ uuid.UUID) ([]domain.FavoriteLocation, error) {
	return r.listResult, r.err
}

func (r *fakeRepository) Create(_ context.Context, params CreateFavoriteLocationParams) (*domain.FavoriteLocation, error) {
	r.lastCreateParams = params
	if r.err != nil {
		return nil, r.err
	}
	if r.createResult != nil {
		return r.createResult, nil
	}

	return &domain.FavoriteLocation{
		ID:      uuid.New(),
		UserID:  params.UserID,
		Name:    params.Name,
		Address: params.Address,
		Point: domain.GeoPoint{
			Lat: params.Lat,
			Lon: params.Lon,
		},
	}, nil
}

func (r *fakeRepository) GetByIDForUser(_ context.Context, _, _ uuid.UUID) (*domain.FavoriteLocation, error) {
	if r.err != nil {
		return nil, r.err
	}
	if r.getResult != nil {
		return r.getResult, nil
	}

	return nil, domain.ErrNotFound
}

func (r *fakeRepository) Update(_ context.Context, params UpdateFavoriteLocationParams) (*domain.FavoriteLocation, error) {
	r.lastUpdateParams = params
	if r.err != nil {
		return nil, r.err
	}
	if r.updateResult != nil {
		return r.updateResult, nil
	}

	return &domain.FavoriteLocation{
		ID:      params.FavoriteLocationID,
		UserID:  params.UserID,
		Name:    params.Name,
		Address: params.Address,
		Point: domain.GeoPoint{
			Lat: params.Lat,
			Lon: params.Lon,
		},
	}, nil
}

func (r *fakeRepository) Delete(_ context.Context, userID, favoriteLocationID uuid.UUID) error {
	r.lastDeleteUserID = userID
	r.lastDeleteID = favoriteLocationID
	return r.err
}

func TestCreateMyFavoriteLocationTrimsAndPersistsValidatedFields(t *testing.T) {
	// given
	repo := &fakeRepository{}
	service := NewService(repo)
	userID := uuid.New()

	// when
	result, err := service.CreateMyFavoriteLocation(context.Background(), CreateFavoriteLocationInput{
		UserID:  userID,
		Name:    "  Home  ",
		Address: "  Istanbul  ",
		Lat:     41.0082,
		Lon:     28.9784,
	})

	// then
	if err != nil {
		t.Fatalf("CreateMyFavoriteLocation() error = %v", err)
	}
	if repo.lastCreateParams.UserID != userID {
		t.Fatalf("expected user id %s, got %s", userID, repo.lastCreateParams.UserID)
	}
	if repo.lastCreateParams.Name != "Home" {
		t.Fatalf("expected trimmed name %q, got %q", "Home", repo.lastCreateParams.Name)
	}
	if repo.lastCreateParams.Address != "Istanbul" {
		t.Fatalf("expected trimmed address %q, got %q", "Istanbul", repo.lastCreateParams.Address)
	}
	if result.Name != "Home" || result.Address != "Istanbul" {
		t.Fatalf("unexpected result %#v", result)
	}
}

func TestCreateMyFavoriteLocationMapsLimitConflict(t *testing.T) {
	// given
	repo := &fakeRepository{err: ErrFavoriteLocationLimitExceeded}
	service := NewService(repo)

	// when
	_, err := service.CreateMyFavoriteLocation(context.Background(), CreateFavoriteLocationInput{
		UserID:  uuid.New(),
		Name:    "Home",
		Address: "Istanbul",
		Lat:     41.0082,
		Lon:     28.9784,
	})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeFavoriteLocationLimitExceeded {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeFavoriteLocationLimitExceeded, appErr.Code)
	}
	if appErr.Status != domain.StatusConflict {
		t.Fatalf("expected status %d, got %d", domain.StatusConflict, appErr.Status)
	}
}

func TestUpdateMyFavoriteLocationMergesExistingFields(t *testing.T) {
	// given
	repo := &fakeRepository{
		getResult: &domain.FavoriteLocation{
			ID:        uuid.New(),
			UserID:    uuid.New(),
			Name:      "Office",
			Address:   "Ankara",
			Point:     domain.GeoPoint{Lat: 39.9334, Lon: 32.8597},
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
	}
	service := NewService(repo)
	newName := "  HQ  "

	// when
	result, err := service.UpdateMyFavoriteLocation(context.Background(), UpdateFavoriteLocationInput{
		UserID:             repo.getResult.UserID,
		FavoriteLocationID: repo.getResult.ID,
		Name:               &newName,
	})

	// then
	if err != nil {
		t.Fatalf("UpdateMyFavoriteLocation() error = %v", err)
	}
	if repo.lastUpdateParams.Name != "HQ" {
		t.Fatalf("expected trimmed name %q, got %q", "HQ", repo.lastUpdateParams.Name)
	}
	if repo.lastUpdateParams.Address != "Ankara" {
		t.Fatalf("expected address to be preserved, got %q", repo.lastUpdateParams.Address)
	}
	if repo.lastUpdateParams.Lat != 39.9334 || repo.lastUpdateParams.Lon != 32.8597 {
		t.Fatalf("expected coordinates to be preserved, got lat=%v lon=%v", repo.lastUpdateParams.Lat, repo.lastUpdateParams.Lon)
	}
	if result.Name != "HQ" {
		t.Fatalf("expected updated name %q, got %q", "HQ", result.Name)
	}
}

func TestDeleteMyFavoriteLocationMapsNotFound(t *testing.T) {
	// given
	repo := &fakeRepository{err: domain.ErrNotFound}
	service := NewService(repo)

	// when
	err := service.DeleteMyFavoriteLocation(context.Background(), uuid.New(), uuid.New())

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeFavoriteLocationNotFound {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeFavoriteLocationNotFound, appErr.Code)
	}
	if appErr.Status != domain.StatusNotFound {
		t.Fatalf("expected status %d, got %d", domain.StatusNotFound, appErr.Status)
	}
}
