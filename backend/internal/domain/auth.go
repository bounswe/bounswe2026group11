package domain

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const (
	OTPChannelEmail         = "email"
	OTPPurposeRegistration  = "registration"
	UserStatusActive        = "active"
	ErrorCodeValidation     = "validation_error"
	ErrorCodeRateLimited    = "rate_limited"
	ErrorCodeInvalidOTP     = "invalid_otp"
	ErrorCodeOTPExhausted   = "otp_attempts_exceeded"
	ErrorCodeInvalidCreds   = "invalid_credentials"
	ErrorCodeInvalidRefresh = "invalid_refresh_token"
	ErrorCodeRefreshReused  = "refresh_token_reused"
	ErrorCodeEmailExists    = "email_already_exists"
	ErrorCodeUsernameExists = "username_already_exists"
	ErrorCodePhoneExists    = "phone_number_already_exists"
)

var ErrNotFound = errors.New("not found")

type AppError struct {
	Code    string
	Message string
	Status  int
	Details map[string]string
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func ValidationError(details map[string]string) *AppError {
	return &AppError{
		Code:    ErrorCodeValidation,
		Message: "The request body contains invalid fields.",
		Status:  http.StatusBadRequest,
		Details: details,
	}
}

func RateLimitedError(message string) *AppError {
	return &AppError{
		Code:    ErrorCodeRateLimited,
		Message: message,
		Status:  http.StatusTooManyRequests,
	}
}

func ConflictError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  http.StatusConflict,
	}
}

func AuthError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  http.StatusUnauthorized,
	}
}

type User struct {
	ID              uuid.UUID
	Username        string
	Email           string
	PhoneNumber     *string
	Gender          *string
	BirthDate       *time.Time
	PasswordHash    string
	EmailVerifiedAt *time.Time
	LastLogin       *time.Time
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type UserSummary struct {
	ID            uuid.UUID `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	PhoneNumber   *string   `json:"phone_number"`
	EmailVerified bool      `json:"email_verified"`
	Status        string    `json:"status"`
}

func (u User) Summary() UserSummary {
	return UserSummary{
		ID:            u.ID,
		Username:      u.Username,
		Email:         u.Email,
		PhoneNumber:   u.PhoneNumber,
		EmailVerified: u.EmailVerifiedAt != nil,
		Status:        u.Status,
	}
}

type OTPChallenge struct {
	ID           uuid.UUID
	UserID       *uuid.UUID
	Channel      string
	Destination  string
	Purpose      string
	CodeHash     string
	ExpiresAt    time.Time
	ConsumedAt   *time.Time
	AttemptCount int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type RefreshToken struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	FamilyID     uuid.UUID
	TokenHash    string
	ExpiresAt    time.Time
	RevokedAt    *time.Time
	ReplacedByID *uuid.UUID
	DeviceInfo   *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type CreateUserParams struct {
	Username        string
	Email           string
	PhoneNumber     *string
	Gender          *string
	BirthDate       *time.Time
	PasswordHash    string
	EmailVerifiedAt time.Time
	Status          string
}

type UpsertOTPChallengeParams struct {
	Channel     string
	Destination string
	Purpose     string
	CodeHash    string
	ExpiresAt   time.Time
	UpdatedAt   time.Time
}

type CreateRefreshTokenParams struct {
	UserID     uuid.UUID
	FamilyID   uuid.UUID
	TokenHash  string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	DeviceInfo *string
}

type AuthStore interface {
	WithTx(ctx context.Context, fn func(store AuthStore) error) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)
	CreateUser(ctx context.Context, params CreateUserParams) (*User, error)
	CreateProfile(ctx context.Context, userID uuid.UUID) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID, lastLogin time.Time) error
	GetActiveOTPChallenge(ctx context.Context, destination, purpose string) (*OTPChallenge, error)
	UpsertOTPChallenge(ctx context.Context, params UpsertOTPChallengeParams) (*OTPChallenge, error)
	IncrementOTPChallengeAttempts(ctx context.Context, challengeID uuid.UUID, updatedAt time.Time) (*OTPChallenge, error)
	ConsumeOTPChallenge(ctx context.Context, challengeID uuid.UUID, consumedAt time.Time) error
	CreateRefreshToken(ctx context.Context, params CreateRefreshTokenParams) (*RefreshToken, error)
	GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshToken, error)
	GetRefreshTokenFamilyCreatedAt(ctx context.Context, familyID uuid.UUID) (time.Time, error)
	RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID, revokedAt time.Time) error
	SetRefreshTokenReplacement(ctx context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error
	RevokeRefreshTokenFamily(ctx context.Context, familyID uuid.UUID, revokedAt time.Time) error
}

type PasswordHasher interface {
	Hash(value string) (string, error)
	Compare(hash, value string) error
}

type TokenIssuer interface {
	IssueAccessToken(user User, issuedAt time.Time) (token string, expiresInSeconds int64, err error)
}

type RefreshTokenManager interface {
	NewToken() (plain string, hash string, err error)
	HashToken(token string) string
}

type OTPCodeGenerator interface {
	NewCode() string
}

type OTPMailer interface {
	SendRegistrationOTP(ctx context.Context, email, code string) error
}

type RateLimiter interface {
	Allow(key string, now time.Time) (allowed bool, retryAfter time.Duration)
}
