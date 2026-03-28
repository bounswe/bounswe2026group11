package auth_handler

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// AuthHandler groups HTTP handlers that delegate to the auth use-case port.
type AuthHandler struct {
	service auth.UseCase
}

// NewAuthHandler creates a handler backed by the given auth use case.
func NewAuthHandler(service auth.UseCase) *AuthHandler {
	return &AuthHandler{service: service}
}

// RegisterAuthRoutes mounts all authentication endpoints under /auth.
func RegisterAuthRoutes(router fiber.Router, handler *AuthHandler) {
	group := router.Group("/auth")
	group.Post("/register/email/request-otp", handler.RequestRegistrationOTP)
	group.Post("/forgot-password/request-otp", handler.RequestPasswordResetOTP)
	group.Post("/forgot-password/verify-otp", handler.VerifyPasswordResetOTP)
	group.Post("/forgot-password/reset-password", handler.ResetPassword)
	group.Post("/register/email/verify", handler.VerifyRegistrationOTP)
	group.Post("/register/check-availability", handler.CheckAvailability)
	group.Post("/login", handler.Login)
	group.Post("/refresh", handler.Refresh)
	group.Post("/logout", handler.Logout)
}

// RequestRegistrationOTP handles POST /auth/register/email/request-otp.
func (h *AuthHandler) RequestRegistrationOTP(c *fiber.Ctx) error {
	var body requestOTPBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	err := h.service.RequestRegistrationOTP(c.UserContext(), auth.RequestOTPInput{
		Email: body.Email,
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"status":  "accepted",
		"message": "If the email can be registered, an OTP has been sent.",
	})
}

// RequestPasswordResetOTP handles POST /auth/forgot-password/request-otp.
func (h *AuthHandler) RequestPasswordResetOTP(c *fiber.Ctx) error {
	var body requestOTPBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	err := h.service.RequestPasswordResetOTP(c.UserContext(), auth.RequestOTPInput{
		Email: body.Email,
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "ok",
		"message": "If an account with that email exists, a password-reset OTP has been sent.",
	})
}

// VerifyPasswordResetOTP handles POST /auth/forgot-password/verify-otp.
func (h *AuthHandler) VerifyPasswordResetOTP(c *fiber.Ctx) error {
	var body verifyPasswordResetBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	grant, err := h.service.VerifyPasswordResetOTP(c.UserContext(), auth.VerifyPasswordResetInput{
		Email: body.Email,
		OTP:   body.OTP,
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(passwordResetGrantResponse{
		Status:           "ok",
		ResetToken:       grant.ResetToken,
		ExpiresInSeconds: grant.ExpiresInSeconds,
	})
}

// ResetPassword handles POST /auth/forgot-password/reset-password.
func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	var body resetPasswordBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	if err := h.service.ResetPassword(c.UserContext(), auth.ResetPasswordInput{
		Email:       body.Email,
		ResetToken:  body.ResetToken,
		NewPassword: body.NewPassword,
	}); err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "ok",
		"message": "Password has been reset.",
	})
}

// CheckAvailability handles POST /auth/register/check-availability.
func (h *AuthHandler) CheckAvailability(c *fiber.Ctx) error {
	var body checkAvailabilityBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	result, err := h.service.CheckAvailability(c.UserContext(), auth.CheckAvailabilityInput{
		Username:  body.Username,
		Email:     body.Email,
		ClientKey: availabilityClientKey(c),
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"username": result.Username,
		"email":    result.Email,
	})
}

// VerifyRegistrationOTP handles POST /auth/register/email/verify.
func (h *AuthHandler) VerifyRegistrationOTP(c *fiber.Ctx) error {
	var body verifyRegistrationBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
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
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(toSessionResponse(session))
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var body loginBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.Login(c.UserContext(), auth.LoginInput{
		Username:   body.Username,
		Password:   body.Password,
		DeviceInfo: userAgent(c),
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(toSessionResponse(session))
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.Refresh(c.UserContext(), body.RefreshToken, userAgent(c))
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(toSessionResponse(session))
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	if err := h.service.Logout(c.UserContext(), body.RefreshToken); err != nil {
		return httpapi.WriteError(c, err)
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

func availabilityClientKey(c *fiber.Ctx) string {
	return strings.TrimSpace(c.IP())
}
