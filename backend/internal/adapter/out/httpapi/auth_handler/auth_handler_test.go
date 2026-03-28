package auth_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestRequestRegistrationOTPReturnsAcceptedResponse(t *testing.T) {
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/email/request-otp", bytes.NewBufferString(`{"email":"user@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("expected status %d, got %d", fiber.StatusAccepted, resp.StatusCode)
	}
	if service.lastOTPRequest.Email != "user@example.com" {
		t.Fatalf("expected service to receive email, got %#v", service.lastOTPRequest)
	}
}

func TestRequestPasswordResetOTPReturnsGenericSuccessResponse(t *testing.T) {
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/forgot-password/request-otp", bytes.NewBufferString(`{"email":"user@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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
	if service.lastPasswordResetOTPRequest.Email != "user@example.com" {
		t.Fatalf("expected service to receive email, got %#v", service.lastPasswordResetOTPRequest)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status body %q, got %q", "ok", body["status"])
	}
	if body["message"] != "If an account with that email exists, a password-reset OTP has been sent." {
		t.Fatalf("unexpected message %q", body["message"])
	}
}

func TestRequestPasswordResetOTPReturnsInternalServerError(t *testing.T) {
	// given
	service := &stubAuthService{
		passwordResetErr: errors.New("smtp down"),
	}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/forgot-password/request-otp", bytes.NewBufferString(`{"email":"user@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Error.Code != "internal_server_error" {
		t.Fatalf("expected error code %q, got %q", "internal_server_error", body.Error.Code)
	}
}

func TestVerifyPasswordResetOTPReturnsResetGrant(t *testing.T) {
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/forgot-password/verify-otp", bytes.NewBufferString(`{"email":"user@example.com","otp":"123456"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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
	if service.lastVerifyPasswordResetRequest.Email != "user@example.com" || service.lastVerifyPasswordResetRequest.OTP != "123456" {
		t.Fatalf("expected verify request to be forwarded, got %#v", service.lastVerifyPasswordResetRequest)
	}

	var body struct {
		Status           string `json:"status"`
		ResetToken       string `json:"reset_token"`
		ExpiresInSeconds int64  `json:"expires_in_seconds"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Status != "ok" || body.ResetToken != "reset-token" || body.ExpiresInSeconds != 600 {
		t.Fatalf("unexpected body %#v", body)
	}
}

func TestResetPasswordReturnsSuccessResponse(t *testing.T) {
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/forgot-password/reset-password", bytes.NewBufferString(`{"email":"user@example.com","reset_token":"reset-token-abcdefghijklmnopqrstuvwxyz","new_password":"NewStrongPassword123"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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
	if service.lastResetPasswordRequest.Email != "user@example.com" ||
		service.lastResetPasswordRequest.ResetToken != "reset-token-abcdefghijklmnopqrstuvwxyz" ||
		service.lastResetPasswordRequest.NewPassword != "NewStrongPassword123" {
		t.Fatalf("expected reset request to be forwarded, got %#v", service.lastResetPasswordRequest)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body["status"] != "ok" || body["message"] != "Password has been reset." {
		t.Fatalf("unexpected body %#v", body)
	}
}

func TestLoginReturnsErrorEnvelope(t *testing.T) {
	// given
	service := &stubAuthService{
		loginErr: domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password."),
	}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/login", bytes.NewBufferString(`{"username":"user","password":"wrong-password"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/email/verify", bytes.NewBufferString(`{"email":"user@example.com","otp":"123456","username":"maplover","password":"StrongPassword123","phone_number":"+905551112233","gender":"female","birth_date":"1998-05-14"}`))
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
	if service.lastVerifyRequest.Gender == nil || *service.lastVerifyRequest.Gender != "female" {
		t.Fatalf("expected gender to be forwarded, got %#v", service.lastVerifyRequest.Gender)
	}
	if service.lastVerifyRequest.BirthDate == nil || *service.lastVerifyRequest.BirthDate != "1998-05-14" {
		t.Fatalf("expected birth date to be forwarded, got %#v", service.lastVerifyRequest.BirthDate)
	}
}

func TestCheckAvailabilityBothAvailable(t *testing.T) {
	// given
	service := &stubAuthService{}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/check-availability", bytes.NewBufferString(`{"username":"new_user","email":"new@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.RemoteAddr = "203.0.113.10:12345"

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

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body["username"] != "AVAILABLE" || body["email"] != "AVAILABLE" {
		t.Fatalf("expected both AVAILABLE, got %v", body)
	}
	if service.lastAvailabilityRequest.ClientKey == "" {
		t.Fatal("expected client key to be forwarded")
	}
}

func TestCheckAvailabilityBothTaken(t *testing.T) {
	// given
	service := &stubAuthService{
		availabilityResult: &auth.CheckAvailabilityResult{Username: "TAKEN", Email: "TAKEN"},
	}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/check-availability", bytes.NewBufferString(`{"username":"existing","email":"taken@example.com"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body["username"] != "TAKEN" || body["email"] != "TAKEN" {
		t.Fatalf("expected both TAKEN, got %v", body)
	}
}

func TestCheckAvailabilityValidationError(t *testing.T) {
	// given
	service := &stubAuthService{
		availabilityErr: domain.ValidationError(map[string]string{"username": "must be 3-32 characters using letters, numbers, or underscores"}),
	}
	app := fiber.New()
	RegisterAuthRoutes(app, NewAuthHandler(service))

	req := httptest.NewRequest(fiber.MethodPost, "/auth/register/check-availability", bytes.NewBufferString(`{"username":"","email":"bad"}`))
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
}

type stubAuthService struct {
	lastOTPRequest                 auth.RequestOTPInput
	lastPasswordResetOTPRequest    auth.RequestOTPInput
	lastVerifyPasswordResetRequest auth.VerifyPasswordResetInput
	lastResetPasswordRequest       auth.ResetPasswordInput
	lastVerifyRequest              auth.VerifyRegistrationInput
	lastAvailabilityRequest        auth.CheckAvailabilityInput
	loginErr                       error
	passwordResetErr               error
	verifyPasswordResetErr         error
	resetPasswordErr               error
	availabilityResult             *auth.CheckAvailabilityResult
	availabilityErr                error
}

func (s *stubAuthService) RequestRegistrationOTP(_ context.Context, input auth.RequestOTPInput) error {
	s.lastOTPRequest = input
	return nil
}

func (s *stubAuthService) RequestPasswordResetOTP(_ context.Context, input auth.RequestOTPInput) error {
	s.lastPasswordResetOTPRequest = input
	return s.passwordResetErr
}

func (s *stubAuthService) VerifyPasswordResetOTP(_ context.Context, input auth.VerifyPasswordResetInput) (*auth.PasswordResetGrant, error) {
	s.lastVerifyPasswordResetRequest = input
	if s.verifyPasswordResetErr != nil {
		return nil, s.verifyPasswordResetErr
	}
	return &auth.PasswordResetGrant{
		ResetToken:       "reset-token",
		ExpiresInSeconds: 600,
	}, nil
}

func (s *stubAuthService) ResetPassword(_ context.Context, input auth.ResetPasswordInput) error {
	s.lastResetPasswordRequest = input
	return s.resetPasswordErr
}

func (s *stubAuthService) CheckAvailability(_ context.Context, input auth.CheckAvailabilityInput) (*auth.CheckAvailabilityResult, error) {
	s.lastAvailabilityRequest = input
	if s.availabilityErr != nil {
		return nil, s.availabilityErr
	}
	if s.availabilityResult != nil {
		return s.availabilityResult, nil
	}
	return &auth.CheckAvailabilityResult{Username: "AVAILABLE", Email: "AVAILABLE"}, nil
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
