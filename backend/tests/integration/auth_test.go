//go:build integration

package integration

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/otp"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/security"
	authapp "github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestAuthCheckAvailabilityReturnsTakenForPersistedIdentity(t *testing.T) {
	t.Parallel()

	// given
	svc, repo, _, _, _, now := newAuthHarness(t)
	username := "taken_" + uuid.NewString()[:8]
	email := uuid.NewString()[:8] + "@example.com"

	_ = givenUser(
		t,
		repo,
		WithUserUsername(username),
		WithUserEmail(email),
		WithUserVerifiedAt(now),
	)

	// when
	result, err := svc.CheckAvailability(context.Background(), authapp.CheckAvailabilityInput{
		Username:  username,
		Email:     stringsToMixedCase(email),
		ClientKey: "203.0.113.10",
	})

	// then
	if err != nil {
		t.Fatalf("CheckAvailability() error = %v", err)
	}
	if result.Username != "TAKEN" {
		t.Fatalf("expected username TAKEN, got %q", result.Username)
	}
	if result.Email != "TAKEN" {
		t.Fatalf("expected email TAKEN, got %q", result.Email)
	}
}

func TestAuthVerifyRegistrationOTPPersistsUserProfileAndRefreshToken(t *testing.T) {
	t.Parallel()

	// given
	svc, repo, tx, mailer, refreshManager, _ := newAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"

	if err := svc.RequestRegistrationOTP(context.Background(), authapp.RequestOTPInput{
		Email: stringsToMixedCase(email),
	}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// when
	session, err := svc.VerifyRegistrationOTP(context.Background(), authapp.VerifyRegistrationInput{
		Email:       email,
		OTP:         mailer.lastCode,
		Username:    "user_" + uuid.NewString()[:8],
		Password:    "super-secret-password",
		PhoneNumber: stringPtr("905551112233"),
		Gender:      stringPtr("female"),
		BirthDate:   stringPtr("1998-05-14"),
		DeviceInfo:  stringPtr("integration-tests"),
	})
	if err != nil {
		t.Fatalf("VerifyRegistrationOTP() error = %v", err)
	}

	// then
	user, err := repo.GetUserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("expected email to be marked verified")
	}

	var profileCount int
	if err := tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM profile WHERE user_id = $1`, user.ID).Scan(&profileCount); err != nil {
		t.Fatalf("profile query error = %v", err)
	}
	if profileCount != 1 {
		t.Fatalf("expected one profile row, got %d", profileCount)
	}

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposeRegistration)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected otp challenge to be consumed, got challenge=%#v err=%v", challenge, err)
	}

	refreshRecord, err := repo.GetRefreshTokenByHash(context.Background(), refreshManager.HashToken(session.RefreshToken))
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash() error = %v", err)
	}
	if refreshRecord.UserID != user.ID {
		t.Fatalf("expected refresh token to belong to %s, got %s", user.ID, refreshRecord.UserID)
	}
	if session.User.Email != email {
		t.Fatalf("expected session user email to be normalized, got %q", session.User.Email)
	}
}

func TestAuthVerifyRegistrationOTPRollsBackOnUsernameConflict(t *testing.T) {
	t.Parallel()

	// given
	svc, repo, tx, _, _, now := newAuthHarness(t)
	takenUsername := "taken_" + uuid.NewString()[:8]
	newEmail := uuid.NewString()[:8] + "@example.com"

	_ = givenUser(
		t,
		repo,
		WithUserUsername(takenUsername),
		WithUserEmail(uuid.NewString()[:8]+"@example.com"),
		WithUserVerifiedAt(now),
	)
	_ = givenOTPChallenge(
		t,
		repo,
		now,
		WithChallengeDestination(newEmail),
		WithChallengeCode("123456"),
	)
	if _, err := tx.Exec(context.Background(), `SAVEPOINT verify_registration_conflict`); err != nil {
		t.Fatalf("SAVEPOINT error = %v", err)
	}

	// when
	_, err := svc.VerifyRegistrationOTP(context.Background(), authapp.VerifyRegistrationInput{
		Email:    newEmail,
		OTP:      "123456",
		Username: takenUsername,
		Password: "super-secret-password",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeUsernameExists)
	if _, err := tx.Exec(context.Background(), `ROLLBACK TO SAVEPOINT verify_registration_conflict`); err != nil {
		t.Fatalf("ROLLBACK TO SAVEPOINT error = %v", err)
	}

	if _, err := repo.GetUserByEmail(context.Background(), newEmail); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected user creation rollback, got err=%v", err)
	}

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), newEmail, domain.OTPPurposeRegistration)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.ConsumedAt != nil {
		t.Fatal("expected otp challenge to remain unconsumed after rollback")
	}

	var profileCount int
	if err := tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM profile`).Scan(&profileCount); err != nil {
		t.Fatalf("profile count query error = %v", err)
	}
	if profileCount != 0 {
		t.Fatalf("expected no profile rows to be created, got %d", profileCount)
	}
}

func newAuthHarness(t *testing.T) (*authapp.Service, *postgresrepo.AuthRepository, pgx.Tx, *capturingMailer, security.RefreshTokenManager, time.Time) {
	t.Helper()

	pool, tx := beginIntegrationTx(t)
	repo := postgresrepo.NewAuthRepositoryWithTx(pool, tx)
	mailer := &capturingMailer{}
	refreshManager := security.RefreshTokenManager{ByteLength: 32}
	now := time.Now().UTC()
	bcryptHasher := hasher.BcryptHasher{Cost: 4}

	service := authapp.NewService(
		repo,
		bcryptHasher,
		bcryptHasher,
		jwtadapter.Issuer{
			Secret: []byte("integration-test-secret"),
			TTL:    15 * time.Minute,
		},
		refreshManager,
		otp.CodeGenerator{},
		mailer,
		noLimitRateLimiter{},
		noLimitRateLimiter{},
		noLimitRateLimiter{},
		authapp.Config{
			OTPTTL:            10 * time.Minute,
			OTPMaxAttempts:    5,
			OTPResendCooldown: time.Minute,
			RefreshTokenTTL:   14 * 24 * time.Hour,
			MaxSessionTTL:     60 * 24 * time.Hour,
		},
	)

	return service, repo, tx, mailer, refreshManager, now
}

func assertAppErrorCode(t *testing.T, err error, expectedCode string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error code %q, got nil", expectedCode)
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError, got %T (%v)", err, err)
	}
	if appErr.Code != expectedCode {
		t.Fatalf("expected error code %q, got %q", expectedCode, appErr.Code)
	}
}

type userOption func(*userFixture)

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

func WithUserUsername(username string) userOption {
	return func(f *userFixture) {
		f.username = username
	}
}

func WithUserEmail(email string) userOption {
	return func(f *userFixture) {
		f.email = email
	}
}

func WithUserVerifiedAt(verifiedAt time.Time) userOption {
	return func(f *userFixture) {
		f.emailVerifiedAt = verifiedAt
	}
}

func givenUser(t *testing.T, repo domain.AuthRepository, opts ...userOption) *domain.User {
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

type challengeOption func(*challengeFixture)

type challengeFixture struct {
	destination string
	code        string
	channel     string
	purpose     string
	expiresAt   time.Time
	updatedAt   time.Time
}

func WithChallengeDestination(destination string) challengeOption {
	return func(f *challengeFixture) {
		f.destination = destination
	}
}

func WithChallengeCode(code string) challengeOption {
	return func(f *challengeFixture) {
		f.code = code
	}
}

func givenOTPChallenge(t *testing.T, repo domain.AuthRepository, now time.Time, opts ...challengeOption) *domain.OTPChallenge {
	t.Helper()

	fixture := &challengeFixture{
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

type capturingMailer struct {
	lastEmail string
	lastCode  string
}

func (m *capturingMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	m.lastEmail = email
	m.lastCode = code
	return nil
}

type noLimitRateLimiter struct{}

func (noLimitRateLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return true, 0
}

func stringPtr(value string) *string {
	return &value
}

func stringsToMixedCase(value string) string {
	return strings.ToUpper(value)
}
