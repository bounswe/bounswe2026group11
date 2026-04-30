package auth_handler

import "github.com/bounswe/bounswe2026group11/backend/internal/domain"

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

type verifyPasswordResetBody struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type resetPasswordBody struct {
	Email       string `json:"email"`
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
}

type checkAvailabilityBody struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

type loginBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type refreshBody struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutBody struct {
	RefreshToken         string  `json:"refresh_token"`
	DeviceInstallationID *string `json:"device_installation_id"`
}

type sessionResponse struct {
	AccessToken      string             `json:"access_token"`
	RefreshToken     string             `json:"refresh_token"`
	TokenType        string             `json:"token_type"`
	ExpiresInSeconds int64              `json:"expires_in_seconds"`
	User             domain.UserSummary `json:"user"`
}

type passwordResetGrantResponse struct {
	Status           string `json:"status"`
	ResetToken       string `json:"reset_token"`
	ExpiresInSeconds int64  `json:"expires_in_seconds"`
}
