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

func TestAuthRequestPasswordResetOTPStoresChallengeForExistingUser(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"
	user := common.GivenUser(
		t,
		harness.Repo,
		common.WithUserUsername("user_"+uuid.NewString()[:8]),
		common.WithUserEmail(email),
		common.WithUserVerifiedAt(harness.Now),
	)

	// when
	if err := harness.Service.RequestPasswordResetOTP(context.Background(), authapp.RequestOTPInput{
		Email: strings.ToUpper(email),
	}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposePasswordReset)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.UserID == nil || *challenge.UserID != user.ID {
		t.Fatalf("expected otp challenge user id %s, got %#v", user.ID, challenge.UserID)
	}
	if harness.Mailer.LastEmail != email {
		t.Fatalf("expected mail to be sent to %q, got %q", email, harness.Mailer.LastEmail)
	}
	if harness.Mailer.LastPurpose != domain.OTPPurposePasswordReset {
		t.Fatalf("expected password reset mail purpose, got %q", harness.Mailer.LastPurpose)
	}
}

func TestAuthRequestPasswordResetOTPUnknownEmailReturnsSilently(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"

	// when
	if err := harness.Service.RequestPasswordResetOTP(context.Background(), authapp.RequestOTPInput{
		Email: email,
	}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposePasswordReset)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected no password reset challenge, got challenge=%#v err=%v", challenge, err)
	}
	if harness.Mailer.LastEmail != "" {
		t.Fatalf("expected no password reset email, got %q", harness.Mailer.LastEmail)
	}
}

func TestAuthVerifyPasswordResetOTPReturnsResetGrantAndConsumesOTP(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"
	common.GivenUser(
		t,
		harness.Repo,
		common.WithUserUsername("user_"+uuid.NewString()[:8]),
		common.WithUserEmail(email),
		common.WithUserVerifiedAt(harness.Now),
	)
	if err := harness.Service.RequestPasswordResetOTP(context.Background(), authapp.RequestOTPInput{
		Email: email,
	}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// when
	grant, err := harness.Service.VerifyPasswordResetOTP(context.Background(), authapp.VerifyPasswordResetInput{
		Email: email,
		OTP:   harness.Mailer.LastCode,
	})
	if err != nil {
		t.Fatalf("VerifyPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposePasswordReset)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected password reset OTP challenge to be consumed, got challenge=%#v err=%v", challenge, err)
	}

	grantChallenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposePasswordResetGrant)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge(grant) error = %v", err)
	}
	if grant.ResetToken == "" {
		t.Fatal("expected reset token to be returned")
	}
	if grantChallenge.CodeHash != harness.RefreshTokens.HashToken(grant.ResetToken) {
		t.Fatal("expected password reset grant to store the hashed reset token")
	}
}

func TestAuthResetPasswordUpdatesStoredHashAndAllowsLoginWithNewPassword(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewAuthHarness(t)
	email := uuid.NewString()[:8] + "@example.com"
	username := "user_" + uuid.NewString()[:8]
	user := common.GivenUser(
		t,
		harness.Repo,
		common.WithUserUsername(username),
		common.WithUserEmail(email),
		common.WithUserVerifiedAt(harness.Now),
	)
	originalUser, err := harness.Repo.GetUserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("GetUserByEmail(before) error = %v", err)
	}

	if err := harness.Service.RequestPasswordResetOTP(context.Background(), authapp.RequestOTPInput{
		Email: email,
	}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}
	grant, err := harness.Service.VerifyPasswordResetOTP(context.Background(), authapp.VerifyPasswordResetInput{
		Email: email,
		OTP:   harness.Mailer.LastCode,
	})
	if err != nil {
		t.Fatalf("VerifyPasswordResetOTP() error = %v", err)
	}

	// when
	if err := harness.Service.ResetPassword(context.Background(), authapp.ResetPasswordInput{
		Email:       email,
		ResetToken:  grant.ResetToken,
		NewPassword: "BrandNewPassword123",
	}); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}

	// then
	updatedUser, err := harness.Repo.GetUserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("GetUserByEmail(after) error = %v", err)
	}
	if updatedUser.ID != user.ID {
		t.Fatalf("expected same user id %s, got %s", user.ID, updatedUser.ID)
	}
	if updatedUser.PasswordHash == originalUser.PasswordHash {
		t.Fatal("expected stored password hash to change")
	}

	grantChallenge, err := harness.Repo.GetActiveOTPChallenge(context.Background(), email, domain.OTPPurposePasswordResetGrant)
	if !errors.Is(err, domain.ErrNotFound) || grantChallenge != nil {
		t.Fatalf("expected password reset grant to be consumed, got challenge=%#v err=%v", grantChallenge, err)
	}

	_, err = harness.Service.Login(context.Background(), authapp.LoginInput{
		Username: username,
		Password: "super-secret-password",
	})
	common.RequireAppErrorCode(t, err, domain.ErrorCodeInvalidCreds)

	session, err := harness.Service.Login(context.Background(), authapp.LoginInput{
		Username: username,
		Password: "BrandNewPassword123",
	})
	if err != nil {
		t.Fatalf("Login(new password) error = %v", err)
	}
	if session.User.ID != user.ID {
		t.Fatalf("expected login to return user %s, got %s", user.ID, session.User.ID)
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
