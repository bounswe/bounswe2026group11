package auth

import (
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// Validation patterns for usernames (alphanumeric + underscore) and OTP codes (6 digits).
var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)
var otpPattern = regexp.MustCompile(`^[0-9]{6}$`)

// validateVerifyRegistrationInput normalizes and validates all registration fields,
// returning cleaned values or a combined validation error.
func validateVerifyRegistrationInput(input VerifyRegistrationInput) (email, username, password string, phoneNumber, gender *string, birthDate *time.Time, otp string, appErr *domain.AppError) {
	email, username, appErr = validateRegistrationIdentity(input.Email, input.Username)
	if appErr != nil {
		return "", "", "", nil, nil, nil, "", appErr
	}

	password = input.Password
	otp = strings.TrimSpace(input.OTP)

	details := make(map[string]string)
	if len(password) < 8 || len(password) > 128 {
		details["password"] = "must be between 8 and 128 characters"
	}
	if !otpPattern.MatchString(otp) {
		details["otp"] = "must be a 6-digit code"
	}
	phoneNumber = sanitizePhoneNumber(input.PhoneNumber, details)
	gender = sanitizeGender(input.Gender, details)
	birthDate = sanitizeBirthDate(input.BirthDate, details)
	if len(details) > 0 {
		return "", "", "", nil, nil, nil, "", domain.ValidationError(details)
	}

	return email, username, password, phoneNumber, gender, birthDate, otp, nil
}

func validateEmailOTPInput(rawEmail, rawOTP string) (email, otp string, appErr *domain.AppError) {
	email, err := normalizeEmail(rawEmail)
	otp = strings.TrimSpace(rawOTP)

	details := make(map[string]string)
	if err != nil {
		details["email"] = "must be a valid email address"
	}
	if !otpPattern.MatchString(otp) {
		details["otp"] = "must be a 6-digit code"
	}
	if len(details) > 0 {
		return "", "", domain.ValidationError(details)
	}

	return email, otp, nil
}

func validateResetPasswordInput(input ResetPasswordInput) (email, resetToken, newPassword string, appErr *domain.AppError) {
	email, err := normalizeEmail(input.Email)
	resetToken = strings.TrimSpace(input.ResetToken)
	newPassword = input.NewPassword

	details := make(map[string]string)
	if err != nil {
		details["email"] = "must be a valid email address"
	}
	if len(resetToken) < 32 || len(resetToken) > 512 {
		details["reset_token"] = "must be between 32 and 512 characters"
	}
	if len(newPassword) < 8 || len(newPassword) > 128 {
		details["new_password"] = "must be between 8 and 128 characters"
	}
	if len(details) > 0 {
		return "", "", "", domain.ValidationError(details)
	}

	return email, resetToken, newPassword, nil
}

// validateLoginInput normalizes and validates login credentials.
func validateLoginInput(input LoginInput) (username, password string, appErr *domain.AppError) {
	username = strings.TrimSpace(input.Username)
	password = input.Password

	details := make(map[string]string)
	if len(username) < 3 || len(username) > 32 {
		details["username"] = "must be between 3 and 32 characters"
	}
	if len(password) < 8 || len(password) > 128 {
		details["password"] = "must be between 8 and 128 characters"
	}
	if len(details) > 0 {
		return "", "", domain.ValidationError(details)
	}

	return username, password, nil
}

func validateRegistrationIdentity(rawEmail, rawUsername string) (email, username string, appErr *domain.AppError) {
	email, err := normalizeEmail(rawEmail)
	username = strings.TrimSpace(rawUsername)

	details := make(map[string]string)
	if err != nil {
		details["email"] = "must be a valid email address"
	}
	if len(username) < 3 || len(username) > 32 || !usernamePattern.MatchString(username) {
		details["username"] = "must be 3-32 characters using letters, numbers, or underscores"
	}
	if len(details) > 0 {
		return "", "", domain.ValidationError(details)
	}

	return email, username, nil
}

// normalizeEmail trims whitespace, lowercases, and parses an email address.
func normalizeEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	addr, err := mail.ParseAddress(value)
	if err != nil {
		return "", err
	}
	return strings.ToLower(addr.Address), nil
}

func sanitizePhoneNumber(value *string, details map[string]string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	if len(trimmed) > 32 {
		details["phone_number"] = "must be at most 32 characters"
		return nil
	}
	return &trimmed
}

func sanitizeGender(value *string, details map[string]string) *string {
	if value == nil {
		return nil
	}
	upper := strings.ToUpper(strings.TrimSpace(*value))
	if upper == "" {
		return nil
	}
	switch upper {
	case "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY":
		return &upper
	default:
		details["gender"] = "must be one of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY"
		return nil
	}
}

func sanitizeBirthDate(value *string, details map[string]string) *time.Time {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		details["birth_date"] = "must be in YYYY-MM-DD format"
		return nil
	}
	return &parsed
}
