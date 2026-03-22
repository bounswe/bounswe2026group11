package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestRequestRegistrationOTPReturnsAcceptedResponse(t *testing.T) {
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/email/request-otp", bytes.NewBufferString(`{"email":"user@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("expected status %d, got %d", fiber.StatusAccepted, resp.StatusCode)
	}
	if service.lastOTPRequest.Email != "user@example.com" {
		t.Fatalf("expected service to receive email, got %#v", service.lastOTPRequest)
	}
}

func TestLoginReturnsErrorEnvelope(t *testing.T) {
	service := &stubAuthService{
		loginErr: domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password."),
	}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/login", bytes.NewBufferString(`{"username":"user","password":"wrong-password"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Error.Code != domain.ErrorCodeInvalidCreds {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeInvalidCreds, body.Error.Code)
	}
}

func TestVerifyRegistrationOTPForwardsUserFields(t *testing.T) {
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/email/verify", bytes.NewBufferString(`{"email":"user@example.com","otp":"123456","username":"maplover","password":"StrongPassword123","phone_number":"+905551112233","gender":"female","birth_date":"1998-05-14"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}
	if service.lastVerifyRequest.Gender == nil || *service.lastVerifyRequest.Gender != "female" {
		t.Fatalf("expected gender to be forwarded, got %#v", service.lastVerifyRequest.Gender)
	}
	if service.lastVerifyRequest.BirthDate == nil || *service.lastVerifyRequest.BirthDate != "1998-05-14" {
		t.Fatalf("expected birth date to be forwarded, got %#v", service.lastVerifyRequest.BirthDate)
	}
}

type stubAuthService struct {
	lastOTPRequest    auth.RequestOTPInput
	lastVerifyRequest auth.VerifyRegistrationInput
	loginErr          error
}

func (s *stubAuthService) RequestRegistrationOTP(_ context.Context, input auth.RequestOTPInput) error {
	s.lastOTPRequest = input
	return nil
}

func (s *stubAuthService) VerifyRegistrationOTP(_ context.Context, input auth.VerifyRegistrationInput) (*auth.Session, error) {
	s.lastVerifyRequest = input
	return &auth.Session{
		AccessToken:      "access",
		RefreshToken:     "refresh",
		TokenType:        "Bearer",
		ExpiresInSeconds: 900,
		User: domain.UserSummary{
			ID:            uuid.New(),
			Username:      "user",
			Email:         "user@example.com",
			EmailVerified: true,
			Status:        domain.UserStatusActive,
		},
	}, nil
}

func (s *stubAuthService) Login(_ context.Context, _ auth.LoginInput) (*auth.Session, error) {
	if s.loginErr != nil {
		return nil, s.loginErr
	}
	return &auth.Session{}, nil
}

func (s *stubAuthService) Refresh(_ context.Context, _ string, _ *string) (*auth.Session, error) {
	return &auth.Session{}, nil
}

func (s *stubAuthService) Logout(_ context.Context, _ string) error {
	return nil
}
