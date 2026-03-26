//go:build integration

package common

import (
	"context"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/hasher"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UserOption customizes a user fixture before it is persisted.
type UserOption func(*userFixture)

type userFixture struct {
	username        string
	email           string
	password        string
	phoneNumber     *string
	gender          *string
	birthDate       *time.Time
	emailVerifiedAt time.Time
	status          string
}

// WithUserUsername overrides the default username for the fixture.
func WithUserUsername(username string) UserOption {
	return func(f *userFixture) {
		f.username = username
	}
}

// WithUserEmail overrides the default email for the fixture.
func WithUserEmail(email string) UserOption {
	return func(f *userFixture) {
		f.email = email
	}
}

// WithUserVerifiedAt overrides the default verification timestamp.
func WithUserVerifiedAt(verifiedAt time.Time) UserOption {
	return func(f *userFixture) {
		f.emailVerifiedAt = verifiedAt
	}
}

// GivenUser persists a user fixture through the provided auth repository.
func GivenUser(t *testing.T, repo domain.AuthRepository, opts ...UserOption) *domain.User {
	t.Helper()

	now := time.Now().UTC()
	fixture := &userFixture{
		username:        "user_" + uuid.NewString()[:8],
		email:           uuid.NewString()[:8] + "@example.com",
		password:        "super-secret-password",
		emailVerifiedAt: now,
		status:          domain.UserStatusActive,
	}
	for _, opt := range opts {
		opt(fixture)
	}

	passwordHash, err := hasher.BcryptHasher{Cost: 4}.Hash(fixture.password)
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}

	user, err := repo.CreateUser(context.Background(), domain.CreateUserParams{
		Username:        fixture.username,
		Email:           fixture.email,
		PhoneNumber:     fixture.phoneNumber,
		Gender:          fixture.gender,
		BirthDate:       fixture.birthDate,
		PasswordHash:    passwordHash,
		EmailVerifiedAt: fixture.emailVerifiedAt,
		Status:          fixture.status,
	})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	return user
}

// OTPChallengeOption customizes an OTP challenge fixture before persistence.
type OTPChallengeOption func(*otpChallengeFixture)

type otpChallengeFixture struct {
	destination string
	code        string
	channel     string
	purpose     string
	expiresAt   time.Time
	updatedAt   time.Time
}

// WithChallengeDestination overrides the default challenge destination.
func WithChallengeDestination(destination string) OTPChallengeOption {
	return func(f *otpChallengeFixture) {
		f.destination = destination
	}
}

// WithChallengeCode overrides the default plaintext OTP code.
func WithChallengeCode(code string) OTPChallengeOption {
	return func(f *otpChallengeFixture) {
		f.code = code
	}
}

// GivenOTPChallenge persists an active OTP challenge fixture.
func GivenOTPChallenge(t *testing.T, repo domain.AuthRepository, now time.Time, opts ...OTPChallengeOption) *domain.OTPChallenge {
	t.Helper()

	fixture := &otpChallengeFixture{
		destination: "user@example.com",
		code:        "123456",
		channel:     domain.OTPChannelEmail,
		purpose:     domain.OTPPurposeRegistration,
		expiresAt:   now.Add(10 * time.Minute),
		updatedAt:   now,
	}
	for _, opt := range opts {
		opt(fixture)
	}

	codeHash, err := hasher.BcryptHasher{Cost: 4}.Hash(fixture.code)
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}

	challenge, err := repo.UpsertOTPChallenge(context.Background(), domain.UpsertOTPChallengeParams{
		Channel:     fixture.channel,
		Destination: fixture.destination,
		Purpose:     fixture.purpose,
		CodeHash:    codeHash,
		ExpiresAt:   fixture.expiresAt,
		UpdatedAt:   fixture.updatedAt,
	})
	if err != nil {
		t.Fatalf("UpsertOTPChallenge() error = %v", err)
	}

	return challenge
}

// GivenEventCategory inserts a category row and returns its ID.
func GivenEventCategory(t *testing.T) int {
	t.Helper()

	name := "category_" + uuid.NewString()[:8]

	var id int
	err := RequirePool(t).QueryRow(
		context.Background(),
		`INSERT INTO event_category (name) VALUES ($1) RETURNING id`,
		name,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert event_category error = %v", err)
	}

	return id
}

func StringPtr(value string) *string {
	return &value
}

func IntPtr(value int) *int {
	return &value
}

func Float64Ptr(value float64) *float64 {
	return &value
}
