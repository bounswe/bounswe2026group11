package httpapi

import (
	"context"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// AuthService is the driving port consumed by the HTTP adapter.
type AuthService interface {
	RequestRegistrationOTP(ctx context.Context, input auth.RequestOTPInput) error
	VerifyRegistrationOTP(ctx context.Context, input auth.VerifyRegistrationInput) (*auth.Session, error)
	Login(ctx context.Context, input auth.LoginInput) (*auth.Session, error)
	Refresh(ctx context.Context, refreshToken string, deviceInfo *string) (*auth.Session, error)
	Logout(ctx context.Context, refreshToken string) error
}

// AuthHandler groups HTTP handlers that delegate to the AuthService port.
type AuthHandler struct {
	service AuthService
}

type requestOTPBody struct {
	Email string `json:"email"`
}

type verifyRegistrationBody struct {
	Email       string  `json:"email"`
	OTP         string  `json:"otp"`
	Username    string  `json:"username"`
	Password    string  `json:"password"`
	PhoneNumber *string `json:"phone_number"`
	Gender      *string `json:"gender"`
	BirthDate   *string `json:"birth_date"`
}

type loginBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type refreshBody struct {
	RefreshToken string `json:"refresh_token"`
}

type sessionResponse struct {
	AccessToken      string             `json:"access_token"`
	RefreshToken     string             `json:"refresh_token"`
	TokenType        string             `json:"token_type"`
	ExpiresInSeconds int64              `json:"expires_in_seconds"`
	User             domain.UserSummary `json:"user"`
}

// NewAuthHandler creates a handler backed by the given auth service.
func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

// RegisterAuthRoutes mounts all authentication endpoints under /auth.
func RegisterAuthRoutes(router fiber.Router, handler *AuthHandler) {
	group := router.Group("/auth")
	group.Post("/register/email/request-otp", handler.RequestRegistrationOTP)
	group.Post("/register/email/verify", handler.VerifyRegistrationOTP)
	group.Post("/login", handler.Login)
	group.Post("/refresh", handler.Refresh)
	group.Post("/logout", handler.Logout)
}

// RequestRegistrationOTP handles POST /auth/register/email/request-otp.
func (h *AuthHandler) RequestRegistrationOTP(c *fiber.Ctx) error {
	var body requestOTPBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	err := h.service.RequestRegistrationOTP(c.UserContext(), auth.RequestOTPInput{
		Email: body.Email,
	})
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"status":  "accepted",
		"message": "If the email can be registered, an OTP has been sent.",
	})
}

// VerifyRegistrationOTP handles POST /auth/register/email/verify.
func (h *AuthHandler) VerifyRegistrationOTP(c *fiber.Ctx) error {
	var body verifyRegistrationBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.VerifyRegistrationOTP(c.UserContext(), auth.VerifyRegistrationInput{
		Email:       body.Email,
		OTP:         body.OTP,
		Username:    body.Username,
		Password:    body.Password,
		PhoneNumber: body.PhoneNumber,
		Gender:      body.Gender,
		BirthDate:   body.BirthDate,
		DeviceInfo:  userAgent(c),
	})
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(toSessionResponse(session))
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var body loginBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.Login(c.UserContext(), auth.LoginInput{
		Username:   body.Username,
		Password:   body.Password,
		DeviceInfo: userAgent(c),
	})
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(toSessionResponse(session))
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.Refresh(c.UserContext(), body.RefreshToken, userAgent(c))
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(toSessionResponse(session))
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	if err := h.service.Logout(c.UserContext(), body.RefreshToken); err != nil {
		return writeError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// toSessionResponse converts an auth.Session into the JSON response payload.
func toSessionResponse(s *auth.Session) sessionResponse {
	return sessionResponse{
		AccessToken:      s.AccessToken,
		RefreshToken:     s.RefreshToken,
		TokenType:        s.TokenType,
		ExpiresInSeconds: s.ExpiresInSeconds,
		User:             s.User,
	}
}

// userAgent extracts the User-Agent header, returning nil if absent or empty.
func userAgent(c *fiber.Ctx) *string {
	value := strings.TrimSpace(c.Get(fiber.HeaderUserAgent))
	if value == "" {
		return nil
	}
	return &value
}
