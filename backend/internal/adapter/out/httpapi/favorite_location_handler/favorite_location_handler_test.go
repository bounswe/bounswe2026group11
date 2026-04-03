package favorite_location_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	favoritelocationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubFavoriteLocationService struct {
	listResult         *favoritelocationapp.ListFavoriteLocationsResult
	locationResult     *favoritelocationapp.FavoriteLocationResult
	err                error
	listCallCount      int
	createCallCount    int
	updateCallCount    int
	deleteCallCount    int
	lastCreateInput    favoritelocationapp.CreateFavoriteLocationInput
	lastUpdateInput    favoritelocationapp.UpdateFavoriteLocationInput
	lastDeleteUserID   uuid.UUID
	lastDeleteLocation uuid.UUID
}

func (s *stubFavoriteLocationService) ListMyFavoriteLocations(_ context.Context, _ uuid.UUID) (*favoritelocationapp.ListFavoriteLocationsResult, error) {
	s.listCallCount++
	if s.err != nil {
		return nil, s.err
	}
	if s.listResult != nil {
		return s.listResult, nil
	}
	return &favoritelocationapp.ListFavoriteLocationsResult{Items: []favoritelocationapp.FavoriteLocationResult{}}, nil
}

func (s *stubFavoriteLocationService) CreateMyFavoriteLocation(_ context.Context, input favoritelocationapp.CreateFavoriteLocationInput) (*favoritelocationapp.FavoriteLocationResult, error) {
	s.createCallCount++
	s.lastCreateInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.locationResult != nil {
		return s.locationResult, nil
	}
	return &favoritelocationapp.FavoriteLocationResult{
		ID:      uuid.NewString(),
		Name:    input.Name,
		Address: input.Address,
		Lat:     input.Lat,
		Lon:     input.Lon,
	}, nil
}

func (s *stubFavoriteLocationService) UpdateMyFavoriteLocation(_ context.Context, input favoritelocationapp.UpdateFavoriteLocationInput) (*favoritelocationapp.FavoriteLocationResult, error) {
	s.updateCallCount++
	s.lastUpdateInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.locationResult != nil {
		return s.locationResult, nil
	}
	return &favoritelocationapp.FavoriteLocationResult{
		ID:      input.FavoriteLocationID.String(),
		Name:    "Home",
		Address: "Istanbul",
		Lat:     41.0082,
		Lon:     28.9784,
	}, nil
}

func (s *stubFavoriteLocationService) DeleteMyFavoriteLocation(_ context.Context, userID, favoriteLocationID uuid.UUID) error {
	s.deleteCallCount++
	s.lastDeleteUserID = userID
	s.lastDeleteLocation = favoriteLocationID
	return s.err
}

type fakeVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
}

func newFavoriteLocationTestApp(service favoritelocationapp.UseCase, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	RegisterRoutes(app, NewHandler(service), httpapi.RequireAuth(verifier))
	return app
}

func authedVerifier() *fakeVerifier {
	return &fakeVerifier{
		claims: &domain.AuthClaims{
			UserID:   uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
		},
	}
}

func TestCreateFavoriteLocationForwardsParsedBody(t *testing.T) {
	// given
	service := &stubFavoriteLocationService{}
	app := newFavoriteLocationTestApp(service, authedVerifier())
	body := bytes.NewBufferString(`{"name":"Home","address":"Istanbul","lat":41.0082,"lon":28.9784}`)
	req := httptest.NewRequest(fiber.MethodPost, "/me/favorite-locations", body)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}
	if service.createCallCount != 1 {
		t.Fatalf("expected create to be called once, got %d", service.createCallCount)
	}
	if service.lastCreateInput.Name != "Home" || service.lastCreateInput.Address != "Istanbul" {
		t.Fatalf("unexpected create input %#v", service.lastCreateInput)
	}
}

func TestCreateFavoriteLocationMissingFieldReturns400(t *testing.T) {
	// given
	service := &stubFavoriteLocationService{}
	app := newFavoriteLocationTestApp(service, authedVerifier())
	body := bytes.NewBufferString(`{"name":"Home","lat":41.0082,"lon":28.9784}`)
	req := httptest.NewRequest(fiber.MethodPost, "/me/favorite-locations", body)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if service.createCallCount != 0 {
		t.Fatalf("expected create not to be called, got %d", service.createCallCount)
	}
}

func TestListFavoriteLocationsRequiresAuthentication(t *testing.T) {
	// given
	service := &stubFavoriteLocationService{}
	app := newFavoriteLocationTestApp(service, authedVerifier())
	req := httptest.NewRequest(fiber.MethodGet, "/me/favorite-locations", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
	if service.listCallCount != 0 {
		t.Fatalf("expected list not to be called, got %d", service.listCallCount)
	}
}

func TestUpdateFavoriteLocationRejectsInvalidID(t *testing.T) {
	// given
	service := &stubFavoriteLocationService{}
	app := newFavoriteLocationTestApp(service, authedVerifier())
	req := httptest.NewRequest(fiber.MethodPatch, "/me/favorite-locations/not-a-uuid", bytes.NewBufferString(`{"name":"Home"}`))
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if service.updateCallCount != 0 {
		t.Fatalf("expected update not to be called, got %d", service.updateCallCount)
	}
}

func TestListFavoriteLocationsReturnsResponseBody(t *testing.T) {
	// given
	service := &stubFavoriteLocationService{
		listResult: &favoritelocationapp.ListFavoriteLocationsResult{
			Items: []favoritelocationapp.FavoriteLocationResult{
				{
					ID:      uuid.NewString(),
					Name:    "Home",
					Address: "Istanbul",
					Lat:     41.0082,
					Lon:     28.9784,
				},
			},
		},
	}
	app := newFavoriteLocationTestApp(service, authedVerifier())
	req := httptest.NewRequest(fiber.MethodGet, "/me/favorite-locations", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body favoritelocationapp.ListFavoriteLocationsResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(body.Items) != 1 || body.Items[0].Name != "Home" {
		t.Fatalf("unexpected response body %#v", body)
	}
}
