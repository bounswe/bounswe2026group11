//go:build integration

package common

import (
	"context"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
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
func GivenUser(t *testing.T, repo authapp.Repository, opts ...UserOption) *domain.User {
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

	user, err := repo.CreateUser(context.Background(), authapp.CreateUserParams{
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
func GivenOTPChallenge(t *testing.T, repo authapp.Repository, now time.Time, opts ...OTPChallengeOption) *domain.OTPChallenge {
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

	challenge, err := repo.UpsertOTPChallenge(context.Background(), authapp.UpsertOTPChallengeParams{
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

// EventRef holds the parsed UUID of a test event fixture.
type EventRef struct {
	ID uuid.UUID
}

// GivenPublicEvent creates a PUBLIC point event owned by hostID and returns a reference to it.
func GivenPublicEvent(t *testing.T, svc eventapp.UseCase, hostID uuid.UUID) *EventRef {
	t.Helper()
	return givenEvent(t, svc, hostID, domain.PrivacyPublic)
}

// GivenProtectedEvent creates a PROTECTED point event owned by hostID and returns a reference to it.
func GivenProtectedEvent(t *testing.T, svc eventapp.UseCase, hostID uuid.UUID) *EventRef {
	t.Helper()
	return givenEvent(t, svc, hostID, domain.PrivacyProtected)
}

func givenEvent(t *testing.T, svc eventapp.UseCase, hostID uuid.UUID, privacyLevel domain.EventPrivacyLevel) *EventRef {
	t.Helper()

	categoryID := GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)

	result, err := svc.CreateEvent(context.Background(), hostID, eventapp.CreateEventInput{
		Title:        "fixture_event_" + uuid.NewString()[:8],
		Description:  StringPtr("A test event fixture"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          Float64Ptr(41.0),
		Lon:          Float64Ptr(29.0),
		StartTime:    startTime,
		PrivacyLevel: privacyLevel,
	})
	if err != nil {
		t.Fatalf("GivenEvent() CreateEvent error = %v", err)
	}

	id, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("GivenEvent() uuid.Parse error = %v", err)
	}

	return &EventRef{ID: id}
}

// GivenExpiredEvent inserts an ACTIVE event whose end_time is in the past directly into the DB.
func GivenExpiredEvent(t *testing.T, hostID uuid.UUID) uuid.UUID {
	t.Helper()

	pool := RequirePool(t)
	categoryID := GivenEventCategory(t)
	past := time.Now().UTC().Add(-2 * time.Hour)

	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO event (host_id, title, privacy_level, status, location_type, start_time, end_time, category_id)
		VALUES ($1, $2, 'PUBLIC', 'ACTIVE', 'POINT', $3, $4, $5)
		RETURNING id`,
		hostID,
		"expired_event_"+uuid.NewString()[:8],
		past.Add(-1*time.Hour),
		past,
		categoryID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("GivenExpiredEvent() insert error = %v", err)
	}

	return id
}

// GivenStartedEvent inserts an ACTIVE event whose start_time is in the past
// but end_time is still in the future.
func GivenStartedEvent(t *testing.T, hostID uuid.UUID) uuid.UUID {
	t.Helper()

	pool := RequirePool(t)
	categoryID := GivenEventCategory(t)
	now := time.Now().UTC()

	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO event (host_id, title, privacy_level, status, location_type, start_time, end_time, category_id)
		VALUES ($1, $2, 'PUBLIC', 'ACTIVE', 'POINT', $3, $4, $5)
		RETURNING id`,
		hostID,
		"started_event_"+uuid.NewString()[:8],
		now.Add(-1*time.Hour),
		now.Add(2*time.Hour),
		categoryID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("GivenStartedEvent() insert error = %v", err)
	}

	return id
}

// GivenOpenEndedStartedEvent inserts an ACTIVE open-ended event (end_time NULL)
// whose start_time is already in the past.
func GivenOpenEndedStartedEvent(t *testing.T, hostID uuid.UUID) uuid.UUID {
	t.Helper()

	pool := RequirePool(t)
	categoryID := GivenEventCategory(t)
	now := time.Now().UTC()

	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO event (host_id, title, privacy_level, status, location_type, start_time, end_time, category_id)
		VALUES ($1, $2, 'PUBLIC', 'ACTIVE', 'POINT', $3, NULL, $4)
		RETURNING id`,
		hostID,
		"open_ended_started_"+uuid.NewString()[:8],
		now.Add(-1*time.Hour),
		categoryID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("GivenOpenEndedStartedEvent() insert error = %v", err)
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
