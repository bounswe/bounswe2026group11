//go:build integration

package integration

import (
	"context"
	"errors"
	"strings"
	"testing"

	authapp "github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests/integration/common"
	"github.com/google/uuid"
)

func TestAuthCheckAvailabilityReturnsTakenForPersistedIdentity(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewAuthHarness(t)
	username := "taken_" + uuid.NewString()[:8]
	email := uuid.NewString()[:8] + "@example.com"

	_ = common.GivenUser(
		t,
		harness.Repo,
		common.WithUserUsername(username),
		common.WithUserEmail(email),
		common.WithUserVerifiedAt(harness.Now),
	)

	// when
	result, err := harness.Service.CheckAvailability(context.Background(), authapp.CheckAvailabilityInput{
		Username:  username,
		Email:     strings.ToUpper(email),
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
	harness := common.NewAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"

	if err := harness.Service.RequestRegistrationOTP(context.Background(), authapp.RequestOTPInput{
		Email: strings.ToUpper(email),
	}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// when
	session, err := harness.Service.VerifyRegistrationOTP(context.Background(), authapp.VerifyRegistrationInput{
		Email:       email,
		OTP:         harness.Mailer.LastCode,
		Username:    "user_" + uuid.NewString()[:8],
		Password:    "super-secret-password",
		PhoneNumber: common.StringPtr("905551112233"),
		Gender:      common.StringPtr("female"),
		BirthDate:   common.StringPtr("1998-05-14"),
		DeviceInfo:  common.StringPtr("integration-tests"),
	})
	if err != nil {
		t.Fatalf("VerifyRegistrationOTP() error = %v", err)
	}

	// then
	user, err := harness.Repo.GetUserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("expected email to be marked verified")
	}

	var profileCount int
	if err := harness.Tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM profile WHERE user_id = $1`, user.ID).Scan(&profileCount); err != nil {
		t.Fatalf("profile query error = %v", err)
	}
	if profileCount != 1 {
		t.Fatalf("expected one profile row, got %d", profileCount)
	}

	challenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposeRegistration)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected otp challenge to be consumed, got challenge=%#v err=%v", challenge, err)
	}

	refreshRecord, err := harness.Repo.GetRefreshTokenByHash(context.Background(), harness.RefreshTokens.HashToken(session.RefreshToken))
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
	harness := common.NewAuthHarness(t)
	takenUsername := "taken_" + uuid.NewString()[:8]
	newEmail := uuid.NewString()[:8] + "@example.com"

	_ = common.GivenUser(
		t,
		harness.Repo,
		common.WithUserUsername(takenUsername),
		common.WithUserEmail(uuid.NewString()[:8]+"@example.com"),
		common.WithUserVerifiedAt(harness.Now),
	)
	_ = common.GivenOTPChallenge(
		t,
		harness.Repo,
		harness.Now,
		common.WithChallengeDestination(newEmail),
		common.WithChallengeCode("123456"),
	)
	if _, err := harness.Tx.Exec(context.Background(), `SAVEPOINT verify_registration_conflict`); err != nil {
		t.Fatalf("SAVEPOINT error = %v", err)
	}

	// when
	_, err := harness.Service.VerifyRegistrationOTP(context.Background(), authapp.VerifyRegistrationInput{
		Email:    newEmail,
		OTP:      "123456",
		Username: takenUsername,
		Password: "super-secret-password",
	})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeUsernameExists)
	if _, err := harness.Tx.Exec(context.Background(), `ROLLBACK TO SAVEPOINT verify_registration_conflict`); err != nil {
		t.Fatalf("ROLLBACK TO SAVEPOINT error = %v", err)
	}

	if _, err := harness.Repo.GetUserByEmail(context.Background(), newEmail); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected user creation rollback, got err=%v", err)
	}

	challenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), newEmail, domain.OTPPurposeRegistration)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.ConsumedAt != nil {
		t.Fatal("expected otp challenge to remain unconsumed after rollback")
	}

	var profileCount int
	if err := harness.Tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM profile`).Scan(&profileCount); err != nil {
		t.Fatalf("profile count query error = %v", err)
	}
	if profileCount != 0 {
		t.Fatalf("expected no profile rows to be created, got %d", profileCount)
	}
}
