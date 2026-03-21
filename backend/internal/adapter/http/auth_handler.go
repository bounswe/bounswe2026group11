package httpadapter

import (
	"context"
	"errors"
	"log"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

type AuthService interface {
	RequestRegistrationOTP(ctx context.Context, input auth.RequestOTPInput) error
	VerifyRegistrationOTP(ctx context.Context, input auth.VerifyRegistrationInput) (*auth.Session, error)
	Login(ctx context.Context, input auth.LoginInput) (*auth.Session, error)
	Refresh(ctx context.Context, refreshToken string, deviceInfo *string) (*auth.Session, error)
	Logout(ctx context.Context, refreshToken string) error
}

type Handler struct {
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

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

func NewHandler(service AuthService) *Handler {
	return &Handler{service: service}
}

func RegisterAuthRoutes(router fiber.Router, handler *Handler) {
	auth := router.Group("/auth")
	auth.Post("/register/email/request-otp", handler.RequestRegistrationOTP)
	auth.Post("/register/email/verify", handler.VerifyRegistrationOTP)
	auth.Post("/login", handler.Login)
	auth.Post("/refresh", handler.Refresh)
	auth.Post("/logout", handler.Logout)
}

func (h *Handler) RequestRegistrationOTP(c *fiber.Ctx) error {
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

func (h *Handler) VerifyRegistrationOTP(c *fiber.Ctx) error {
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

	return c.Status(fiber.StatusCreated).JSON(session)
}

func (h *Handler) Login(c *fiber.Ctx) error {
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

	return c.Status(fiber.StatusOK).JSON(session)
}

func (h *Handler) Refresh(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	session, err := h.service.Refresh(c.UserContext(), body.RefreshToken, userAgent(c))
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(session)
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	var body refreshBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	if err := h.service.Logout(c.UserContext(), body.RefreshToken); err != nil {
		return writeError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func writeError(c *fiber.Ctx, err error) error {
	var appErr *domain.AppError
	if errors.As(err, &appErr) {
		return c.Status(appErr.Status).JSON(errorEnvelope{
			Error: errorBody{
				Code:    appErr.Code,
				Message: appErr.Message,
				Details: appErr.Details,
			},
		})
	}

	log.Printf("auth handler error: %v", err)
	return c.Status(fiber.StatusInternalServerError).JSON(errorEnvelope{
		Error: errorBody{
			Code:    "internal_server_error",
			Message: "An unexpected error occurred.",
		},
	})
}

func userAgent(c *fiber.Ctx) *string {
	value := strings.TrimSpace(c.Get(fiber.HeaderUserAgent))
	if value == "" {
		return nil
	}
	return &value
}
