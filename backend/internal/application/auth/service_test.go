package auth

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

func TestRequestRegistrationOTPStoresHashedChallenge(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "User@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// then
	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.CodeHash == mailer.lastCode {
		t.Fatal("expected OTP to be stored as a hash, got plaintext")
	}
	if mailer.lastEmail != "user@example.com" {
		t.Fatalf("expected mail to be sent to normalized email, got %q", mailer.lastEmail)
	}
}

func TestRequestPasswordResetOTPStoresHashedChallengeForExistingUser(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	// when
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "User@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordReset)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.CodeHash == mailer.lastCode {
		t.Fatal("expected OTP to be stored as a hash, got plaintext")
	}
	if challenge.UserID == nil || *challenge.UserID != user.ID {
		t.Fatalf("expected challenge user id %s, got %#v", user.ID, challenge.UserID)
	}
	if mailer.lastEmail != "user@example.com" {
		t.Fatalf("expected mail to be sent to normalized email, got %q", mailer.lastEmail)
	}
	if mailer.lastPurpose != domain.OTPPurposePasswordReset {
		t.Fatalf("expected password reset mail purpose, got %q", mailer.lastPurpose)
	}
}

func TestRequestPasswordResetOTPUnknownEmailReturnsSilently(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "missing@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "missing@example.com", domain.OTPPurposePasswordReset)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected no password reset challenge, got challenge=%#v err=%v", challenge, err)
	}
	if mailer.passwordResetSendCount != 0 {
		t.Fatalf("expected no password reset email, got %d sends", mailer.passwordResetSendCount)
	}
}

func TestRequestPasswordResetOTPValidationError(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "not-an-email"})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeValidation)
}

func TestRequestPasswordResetOTPIsSilentlyRateLimited(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }
	svc.otpRateLimiter = denyAllLimiter{}

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	// when
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordReset)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected no password reset challenge, got challenge=%#v err=%v", challenge, err)
	}
	if mailer.passwordResetSendCount != 0 {
		t.Fatalf("expected no password reset email, got %d sends", mailer.passwordResetSendCount)
	}
}

func TestRequestPasswordResetOTPCooldownReturnsSilently(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("first RequestPasswordResetOTP() error = %v", err)
	}

	// when
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("second RequestPasswordResetOTP() error = %v", err)
	}

	// then
	if mailer.passwordResetSendCount != 1 {
		t.Fatalf("expected one password reset email, got %d sends", mailer.passwordResetSendCount)
	}
}

func TestRequestPasswordResetOTPMailerErrorReturned(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }
	mailer.passwordResetErr = errors.New("smtp down")

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	// when
	err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"})

	// then
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestVerifyPasswordResetOTPReturnsResetGrantAndConsumesOTP(t *testing.T) {
	// given
	svc, repo, mailer, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// when
	grant, err := svc.VerifyPasswordResetOTP(context.Background(), VerifyPasswordResetInput{
		Email: "user@example.com",
		OTP:   mailer.lastCode,
	})
	if err != nil {
		t.Fatalf("VerifyPasswordResetOTP() error = %v", err)
	}

	// then
	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordReset)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected password reset OTP challenge to be consumed, got challenge=%#v err=%v", challenge, err)
	}

	grantChallenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordResetGrant)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge(grant) error = %v", err)
	}
	if grant.ResetToken == "" {
		t.Fatal("expected reset token to be returned")
	}
	if grantChallenge.CodeHash != refreshManager.HashToken(grant.ResetToken) {
		t.Fatal("expected password reset grant to store the hashed reset token")
	}
	if grant.ExpiresInSeconds != int64((10*time.Minute)/time.Second) {
		t.Fatalf("expected 600 seconds, got %d", grant.ExpiresInSeconds)
	}
}

func TestVerifyPasswordResetOTPInvalidCodeIncrementsAttempts(t *testing.T) {
	// given
	svc, repo, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}

	// when
	_, err := svc.VerifyPasswordResetOTP(context.Background(), VerifyPasswordResetInput{
		Email: "user@example.com",
		OTP:   "000000",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordReset)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.AttemptCount != 1 {
		t.Fatalf("expected attempt count to increment, got %d", challenge.AttemptCount)
	}
}

func TestResetPasswordUpdatesPasswordAndConsumesGrant(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:old-password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}
	grant, err := svc.VerifyPasswordResetOTP(context.Background(), VerifyPasswordResetInput{
		Email: "user@example.com",
		OTP:   mailer.lastCode,
	})
	if err != nil {
		t.Fatalf("VerifyPasswordResetOTP() error = %v", err)
	}

	// when
	if err := svc.ResetPassword(context.Background(), ResetPasswordInput{
		Email:       "user@example.com",
		ResetToken:  grant.ResetToken,
		NewPassword: "new-password-123",
	}); err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}

	// then
	user, err := repo.GetUserByEmail(context.Background(), "user@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if user.PasswordHash != "hash:new-password-123" {
		t.Fatalf("expected updated password hash, got %q", user.PasswordHash)
	}

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposePasswordResetGrant)
	if !errors.Is(err, domain.ErrNotFound) || challenge != nil {
		t.Fatalf("expected password reset grant to be consumed, got challenge=%#v err=%v", challenge, err)
	}

	_, err = svc.Login(context.Background(), LoginInput{
		Username: "existing_user",
		Password: "old-password",
	})
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidCreds)

	session, err := svc.Login(context.Background(), LoginInput{
		Username: "existing_user",
		Password: "new-password-123",
	})
	if err != nil {
		t.Fatalf("Login(new password) error = %v", err)
	}
	if session.AccessToken == "" {
		t.Fatal("expected login with new password to succeed")
	}
}

func TestResetPasswordRejectsInvalidGrant(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "user@example.com",
		PasswordHash:    "hash:old-password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if err := svc.RequestPasswordResetOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestPasswordResetOTP() error = %v", err)
	}
	grant, err := svc.VerifyPasswordResetOTP(context.Background(), VerifyPasswordResetInput{
		Email: "user@example.com",
		OTP:   mailer.lastCode,
	})
	if err != nil {
		t.Fatalf("VerifyPasswordResetOTP() error = %v", err)
	}

	// when
	err = svc.ResetPassword(context.Background(), ResetPasswordInput{
		Email:       "user@example.com",
		ResetToken:  grant.ResetToken + "-wrong",
		NewPassword: "new-password-123",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidResetToken)
}

func TestResetPasswordValidationError(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	err := svc.ResetPassword(context.Background(), ResetPasswordInput{
		Email:       "not-an-email",
		ResetToken:  "short",
		NewPassword: "short",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeValidation)
}

func TestVerifyRegistrationOTPSuccessCreatesUserAndSession(t *testing.T) {
	// given
	svc, repo, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	phoneNumber := "+905551112233"
	gender := "female"
	birthDate := "1998-05-14"

	// when
	session, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:       "user@example.com",
		OTP:         mailer.lastCode,
		Username:    "new_user",
		Password:    "super-secret-password",
		PhoneNumber: &phoneNumber,
		Gender:      &gender,
		BirthDate:   &birthDate,
		DeviceInfo:  stringPtr("tests"),
	})
	if err != nil {
		t.Fatalf("VerifyRegistrationOTP() error = %v", err)
	}

	// then
	user, err := repo.GetUserByEmail(context.Background(), "user@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail() error = %v", err)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatal("expected email to be marked verified")
	}
	if user.PhoneNumber == nil || *user.PhoneNumber != phoneNumber {
		t.Fatalf("expected phone number to be stored, got %#v", user.PhoneNumber)
	}
	if user.Gender == nil || *user.Gender != gender {
		t.Fatalf("expected gender to be stored, got %#v", user.Gender)
	}
	if user.BirthDate == nil || user.BirthDate.Format("2006-01-02") != birthDate {
		t.Fatalf("expected birth date to be stored, got %#v", user.BirthDate)
	}
	if !repo.profiles[user.ID] {
		t.Fatal("expected profile to be created")
	}

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
	if !errors.Is(err, domain.ErrNotFound) && challenge != nil {
		t.Fatal("expected OTP challenge to be consumed")
	}

	if session.AccessToken == "" || session.RefreshToken == "" {
		t.Fatal("expected session tokens to be returned")
	}
	if !session.User.EmailVerified {
		t.Fatal("expected response user summary to reflect verified email")
	}
}

func TestVerifyRegistrationOTPRejectsInvalidBirthDate(t *testing.T) {
	// given
	svc, _, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// when
	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:     "user@example.com",
		OTP:       mailer.lastCode,
		Username:  "new_user",
		Password:  "super-secret-password",
		BirthDate: stringPtr("14-05-1998"),
	})

	// then
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError, got %T (%v)", err, err)
	}
	if got := appErr.Details["birth_date"]; got != "must be in YYYY-MM-DD format" {
		t.Fatalf("expected birth_date validation error, got %#v", appErr.Details)
	}
}

func TestVerifyRegistrationOTPInvalidCodeIncrementsAttempts(t *testing.T) {
	// given
	svc, repo, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// when
	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:    "user@example.com",
		OTP:      "000000",
		Username: "user_one",
		Password: "super-secret-password",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)

	challenge, err := repo.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.AttemptCount != 1 {
		t.Fatalf("expected attempt count to increment, got %d", challenge.AttemptCount)
	}
}

func TestVerifyRegistrationOTPExpiredCodeRejected(t *testing.T) {
	// given
	svc, _, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	svc.now = func() time.Time { return now.Add(11 * time.Minute) }

	// when
	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:    "user@example.com",
		OTP:      mailer.lastCode,
		Username: "user_one",
		Password: "super-secret-password",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)
}

func TestVerifyRegistrationOTPAttemptExhaustion(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.otpMaxAttempts = 2
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	// when
	for i := 0; i < 2; i++ {
		_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
			Email:    "user@example.com",
			OTP:      "000000",
			Username: "user_one",
			Password: "super-secret-password",
		})
		// then
		if i == 0 {
			assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)
			continue
		}
		assertAppErrorCode(t, err, domain.ErrorCodeOTPExhausted)
	}
}

func TestLoginWrongPasswordRejected(t *testing.T) {
	// given
	svc, repo, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	passwordHash, err := svc.passwordHasher.Hash("correct-password")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "existing_user",
		Email:           "existing@example.com",
		PasswordHash:    passwordHash,
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	// when
	_, err = svc.Login(context.Background(), LoginInput{
		Username: "existing_user",
		Password: "wrong-password",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidCreds)
}

func TestRefreshRotatesTokenAndRejectsReuse(t *testing.T) {
	// given
	svc, repo, mailer, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}
	session, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:    "user@example.com",
		OTP:      mailer.lastCode,
		Username: "session_user",
		Password: "super-secret-password",
	})
	if err != nil {
		t.Fatalf("VerifyRegistrationOTP() error = %v", err)
	}

	// when
	refreshed, err := svc.Refresh(context.Background(), session.RefreshToken, stringPtr("device"))
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}

	// then
	if refreshed.RefreshToken == session.RefreshToken {
		t.Fatal("expected refresh rotation to issue a new refresh token")
	}

	oldHash := refreshManager.HashToken(session.RefreshToken)
	oldRecord, err := repo.GetRefreshTokenByHash(context.Background(), oldHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash(old) error = %v", err)
	}
	if oldRecord.RevokedAt == nil || oldRecord.ReplacedByID == nil {
		t.Fatal("expected original refresh token to be revoked and linked to replacement")
	}

	// when
	_, err = svc.Refresh(context.Background(), session.RefreshToken, stringPtr("device"))

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeRefreshReused)

	newHash := refreshManager.HashToken(refreshed.RefreshToken)
	newRecord, err := repo.GetRefreshTokenByHash(context.Background(), newHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash(new) error = %v", err)
	}
	if newRecord.RevokedAt == nil {
		t.Fatal("expected token family reuse detection to revoke the active replacement token")
	}
	if got := newRecord.ExpiresAt.Sub(now); got != 14*24*time.Hour {
		t.Fatalf("expected rotated refresh token TTL to be 14 days, got %s", got)
	}
}

func TestRefreshCapsRotatedTokenAtAbsoluteSessionLimit(t *testing.T) {
	// given
	svc, repo, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "cap_user",
		Email:           "cap@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	plain, hash, err := refreshManager.NewToken()
	if err != nil {
		t.Fatalf("NewToken() error = %v", err)
	}
	familyID := uuid.New()
	familyStartedAt := now.Add(-55 * 24 * time.Hour)
	if _, err := repo.CreateRefreshToken(context.Background(), CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  familyID,
		TokenHash: hash,
		CreatedAt: familyStartedAt,
		ExpiresAt: now.Add(24 * time.Hour),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	// when
	refreshed, err := svc.Refresh(context.Background(), plain, nil)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}

	// then
	newHash := refreshManager.HashToken(refreshed.RefreshToken)
	newRecord, err := repo.GetRefreshTokenByHash(context.Background(), newHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash(new) error = %v", err)
	}
	expectedExpiry := familyStartedAt.Add(60 * 24 * time.Hour)
	if !newRecord.ExpiresAt.Equal(expectedExpiry) {
		t.Fatalf("expected absolute expiry %s, got %s", expectedExpiry, newRecord.ExpiresAt)
	}
}

func TestRefreshRejectsExpiredAbsoluteSession(t *testing.T) {
	// given
	svc, repo, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "absolute_user",
		Email:           "absolute@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	plain, hash, err := refreshManager.NewToken()
	if err != nil {
		t.Fatalf("NewToken() error = %v", err)
	}
	if _, err := repo.CreateRefreshToken(context.Background(), CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  uuid.New(),
		TokenHash: hash,
		CreatedAt: now.Add(-60 * 24 * time.Hour),
		ExpiresAt: now.Add(time.Hour),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	// when
	_, err = svc.Refresh(context.Background(), plain, nil)

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidRefresh)
}

func TestRefreshExpiredTokenRejected(t *testing.T) {
	// given
	svc, repo, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "expired_user",
		Email:           "expired@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	})
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	plain, hash, err := refreshManager.NewToken()
	if err != nil {
		t.Fatalf("NewToken() error = %v", err)
	}
	if _, err := repo.CreateRefreshToken(context.Background(), CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  uuid.New(),
		TokenHash: hash,
		CreatedAt: now.Add(-2 * time.Hour),
		ExpiresAt: now.Add(-time.Minute),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	// when
	_, err = svc.Refresh(context.Background(), plain, nil)

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidRefresh)
}

func TestCheckAvailabilityBothAvailable(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	result, err := svc.CheckAvailability(context.Background(), CheckAvailabilityInput{
		Username: "fresh_user",
		Email:    "fresh@example.com",
	})

	// then
	if err != nil {
		t.Fatalf("CheckAvailability() error = %v", err)
	}
	if result.Username != "AVAILABLE" {
		t.Fatalf("expected username AVAILABLE, got %q", result.Username)
	}
	if result.Email != "AVAILABLE" {
		t.Fatalf("expected email AVAILABLE, got %q", result.Email)
	}
}

func TestCheckAvailabilityBothTaken(t *testing.T) {
	// given
	svc, repo, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if _, err := repo.CreateUser(context.Background(), CreateUserParams{
		Username:        "taken_user",
		Email:           "taken@example.com",
		PasswordHash:    "hash:password",
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	// when
	result, err := svc.CheckAvailability(context.Background(), CheckAvailabilityInput{
		Username: "taken_user",
		Email:    "taken@example.com",
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

func TestCheckAvailabilityValidationError(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	// when
	_, err := svc.CheckAvailability(context.Background(), CheckAvailabilityInput{
		Username: "ab",
		Email:    "not-an-email",
	})

	// then
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError, got %T (%v)", err, err)
	}
	if appErr.Code != domain.ErrorCodeValidation {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeValidation, appErr.Code)
	}
	if _, ok := appErr.Details["username"]; !ok {
		t.Fatal("expected username validation detail")
	}
	if _, ok := appErr.Details["email"]; !ok {
		t.Fatal("expected email validation detail")
	}
}

func TestCheckAvailabilityRateLimited(t *testing.T) {
	// given
	svc, _, _, _, now := newTestService()
	svc.now = func() time.Time { return now }
	svc.availabilityRateLimiter = denyAllLimiter{}

	// when
	_, err := svc.CheckAvailability(context.Background(), CheckAvailabilityInput{
		Username:  "fresh_user",
		Email:     "fresh@example.com",
		ClientKey: "203.0.113.10",
	})

	// then
	assertAppErrorCode(t, err, domain.ErrorCodeRateLimited)
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

func newTestService() (*Service, *fakeRepo, *fakeMailer, *fakeRefreshTokenManager, time.Time) {
	repo := newFakeRepo()
	mailer := &fakeMailer{}
	refreshManager := &fakeRefreshTokenManager{}
	now := time.Date(2026, time.March, 21, 10, 0, 0, 0, time.UTC)
	service := NewService(
		repo,
		fakeHasher{},
		fakeHasher{},
		fakeTokenIssuer{},
		refreshManager,
		fakeOTPGenerator{code: "123456"},
		mailer,
		allowAllLimiter{},
		allowAllLimiter{},
		allowAllLimiter{},
		Config{
			OTPTTL:            10 * time.Minute,
			OTPMaxAttempts:    5,
			OTPResendCooldown: time.Minute,
			RefreshTokenTTL:   14 * 24 * time.Hour,
			MaxSessionTTL:     60 * 24 * time.Hour,
		},
	)
	return service, repo, mailer, refreshManager, now
}

type fakeRepo struct {
	usersByEmail    map[string]*domain.User
	usersByUsername map[string]*domain.User
	usersByID       map[uuid.UUID]*domain.User
	phoneToUser     map[string]uuid.UUID
	profiles        map[uuid.UUID]bool
	challenges      map[string]*domain.OTPChallenge
	refreshByHash   map[string]*domain.RefreshToken
	refreshByID     map[uuid.UUID]*domain.RefreshToken
	refreshByFamily map[uuid.UUID][]uuid.UUID
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		usersByEmail:    make(map[string]*domain.User),
		usersByUsername: make(map[string]*domain.User),
		usersByID:       make(map[uuid.UUID]*domain.User),
		phoneToUser:     make(map[string]uuid.UUID),
		profiles:        make(map[uuid.UUID]bool),
		challenges:      make(map[string]*domain.OTPChallenge),
		refreshByHash:   make(map[string]*domain.RefreshToken),
		refreshByID:     make(map[uuid.UUID]*domain.RefreshToken),
		refreshByFamily: make(map[uuid.UUID][]uuid.UUID),
	}
}

func (r *fakeRepo) WithTx(_ context.Context, fn func(repo Repository) error) error {
	return fn(r)
}

func (r *fakeRepo) GetUserByEmail(_ context.Context, email string) (*domain.User, error) {
	user, ok := r.usersByEmail[email]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (r *fakeRepo) GetUserByUsername(_ context.Context, username string) (*domain.User, error) {
	user, ok := r.usersByUsername[username]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (r *fakeRepo) GetUserByID(_ context.Context, userID uuid.UUID) (*domain.User, error) {
	user, ok := r.usersByID[userID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (r *fakeRepo) CreateUser(_ context.Context, params CreateUserParams) (*domain.User, error) {
	if _, exists := r.usersByEmail[params.Email]; exists {
		return nil, domain.ConflictError(domain.ErrorCodeEmailExists, "The email is already in use.")
	}
	if _, exists := r.usersByUsername[params.Username]; exists {
		return nil, domain.ConflictError(domain.ErrorCodeUsernameExists, "The username is already in use.")
	}
	if params.PhoneNumber != nil {
		if _, exists := r.phoneToUser[*params.PhoneNumber]; exists {
			return nil, domain.ConflictError(domain.ErrorCodePhoneExists, "The phone number is already in use.")
		}
	}

	user := &domain.User{
		ID:              uuid.New(),
		Username:        params.Username,
		Email:           params.Email,
		PhoneNumber:     params.PhoneNumber,
		Gender:          params.Gender,
		BirthDate:       params.BirthDate,
		PasswordHash:    params.PasswordHash,
		EmailVerifiedAt: timePtr(params.EmailVerifiedAt),
		Status:          params.Status,
		CreatedAt:       params.EmailVerifiedAt,
		UpdatedAt:       params.EmailVerifiedAt,
	}
	r.usersByEmail[user.Email] = user
	r.usersByUsername[user.Username] = user
	r.usersByID[user.ID] = user
	if user.PhoneNumber != nil {
		r.phoneToUser[*user.PhoneNumber] = user.ID
	}
	return user, nil
}

func (r *fakeRepo) UpdatePassword(_ context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error {
	user, ok := r.usersByID[userID]
	if !ok {
		return domain.ErrNotFound
	}
	user.PasswordHash = passwordHash
	user.UpdatedAt = updatedAt
	return nil
}

func (r *fakeRepo) CreateProfile(_ context.Context, userID uuid.UUID) error {
	r.profiles[userID] = true
	return nil
}

func (r *fakeRepo) UpdateLastLogin(_ context.Context, userID uuid.UUID, lastLogin time.Time) error {
	user, ok := r.usersByID[userID]
	if !ok {
		return domain.ErrNotFound
	}
	user.LastLogin = timePtr(lastLogin)
	return nil
}

func (r *fakeRepo) GetActiveOTPChallenge(_ context.Context, destination, purpose string) (*domain.OTPChallenge, error) {
	challenge, ok := r.challenges[challengeKey(destination, purpose)]
	if !ok || challenge.ConsumedAt != nil {
		return nil, domain.ErrNotFound
	}
	return challenge, nil
}

func (r *fakeRepo) UpsertOTPChallenge(_ context.Context, params UpsertOTPChallengeParams) (*domain.OTPChallenge, error) {
	key := challengeKey(params.Destination, params.Purpose)
	if existing, ok := r.challenges[key]; ok && existing.ConsumedAt == nil {
		existing.UserID = params.UserID
		existing.Channel = params.Channel
		existing.CodeHash = params.CodeHash
		existing.ExpiresAt = params.ExpiresAt
		existing.AttemptCount = 0
		existing.UpdatedAt = params.UpdatedAt
		return existing, nil
	}

	challenge := &domain.OTPChallenge{
		ID:           uuid.New(),
		UserID:       params.UserID,
		Channel:      params.Channel,
		Destination:  params.Destination,
		Purpose:      params.Purpose,
		CodeHash:     params.CodeHash,
		ExpiresAt:    params.ExpiresAt,
		AttemptCount: 0,
		CreatedAt:    params.UpdatedAt,
		UpdatedAt:    params.UpdatedAt,
	}
	r.challenges[key] = challenge
	return challenge, nil
}

func (r *fakeRepo) IncrementOTPChallengeAttempts(_ context.Context, challengeID uuid.UUID, updatedAt time.Time) (*domain.OTPChallenge, error) {
	for _, challenge := range r.challenges {
		if challenge.ID == challengeID {
			challenge.AttemptCount++
			challenge.UpdatedAt = updatedAt
			return challenge, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (r *fakeRepo) ConsumeOTPChallenge(_ context.Context, challengeID uuid.UUID, consumedAt time.Time) error {
	for _, challenge := range r.challenges {
		if challenge.ID == challengeID {
			challenge.ConsumedAt = timePtr(consumedAt)
			challenge.UpdatedAt = consumedAt
			return nil
		}
	}
	return domain.ErrNotFound
}

func (r *fakeRepo) CreateRefreshToken(_ context.Context, params CreateRefreshTokenParams) (*domain.RefreshToken, error) {
	record := &domain.RefreshToken{
		ID:         uuid.New(),
		UserID:     params.UserID,
		FamilyID:   params.FamilyID,
		TokenHash:  params.TokenHash,
		ExpiresAt:  params.ExpiresAt,
		DeviceInfo: params.DeviceInfo,
		CreatedAt:  params.CreatedAt,
		UpdatedAt:  params.CreatedAt,
	}
	r.refreshByHash[record.TokenHash] = record
	r.refreshByID[record.ID] = record
	r.refreshByFamily[record.FamilyID] = append(r.refreshByFamily[record.FamilyID], record.ID)
	return record, nil
}

func (r *fakeRepo) GetRefreshTokenByHash(_ context.Context, tokenHash string) (*domain.RefreshToken, error) {
	record, ok := r.refreshByHash[tokenHash]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return record, nil
}

func (r *fakeRepo) GetRefreshTokenFamilyCreatedAt(_ context.Context, familyID uuid.UUID) (time.Time, error) {
	tokenIDs := r.refreshByFamily[familyID]
	if len(tokenIDs) == 0 {
		return time.Time{}, domain.ErrNotFound
	}

	createdAt := r.refreshByID[tokenIDs[0]].CreatedAt
	for _, tokenID := range tokenIDs[1:] {
		record := r.refreshByID[tokenID]
		if record.CreatedAt.Before(createdAt) {
			createdAt = record.CreatedAt
		}
	}
	return createdAt, nil
}

func (r *fakeRepo) RevokeRefreshToken(_ context.Context, tokenID uuid.UUID, revokedAt time.Time) error {
	record, ok := r.refreshByID[tokenID]
	if !ok {
		return domain.ErrNotFound
	}
	record.RevokedAt = timePtr(revokedAt)
	record.UpdatedAt = revokedAt
	return nil
}

func (r *fakeRepo) SetRefreshTokenReplacement(_ context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error {
	record, ok := r.refreshByID[tokenID]
	if !ok {
		return domain.ErrNotFound
	}
	record.ReplacedByID = uuidPtr(replacedByID)
	record.UpdatedAt = updatedAt
	return nil
}

func (r *fakeRepo) RevokeRefreshTokenFamily(_ context.Context, familyID uuid.UUID, revokedAt time.Time) error {
	for _, tokenID := range r.refreshByFamily[familyID] {
		record := r.refreshByID[tokenID]
		if record.RevokedAt == nil {
			record.RevokedAt = timePtr(revokedAt)
			record.UpdatedAt = revokedAt
		}
	}
	return nil
}

type fakeHasher struct{}

func (fakeHasher) Hash(value string) (string, error) {
	return "hash:" + value, nil
}

func (fakeHasher) Compare(hash, value string) error {
	if hash != "hash:"+value {
		return errors.New("mismatch")
	}
	return nil
}

type fakeTokenIssuer struct{}

func (fakeTokenIssuer) IssueAccessToken(user domain.User, _ time.Time) (string, int64, error) {
	return "access-" + user.ID.String(), 900, nil
}

type fakeRefreshTokenManager struct {
	counter int
}

func (m *fakeRefreshTokenManager) NewToken() (string, string, error) {
	m.counter++
	plain := fmt.Sprintf("reset-token-%032d", m.counter)
	return plain, m.HashToken(plain), nil
}

func (m *fakeRefreshTokenManager) HashToken(token string) string {
	return "token-hash:" + token
}

type fakeOTPGenerator struct {
	code string
}

func (g fakeOTPGenerator) NewCode() string {
	return g.code
}

type fakeMailer struct {
	lastEmail              string
	lastCode               string
	lastPurpose            string
	passwordResetErr       error
	registrationSendCount  int
	passwordResetSendCount int
}

func (m *fakeMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	m.registrationSendCount++
	m.lastEmail = email
	m.lastCode = code
	m.lastPurpose = domain.OTPPurposeRegistration
	return nil
}

func (m *fakeMailer) SendPasswordResetOTP(_ context.Context, email, code string) error {
	m.passwordResetSendCount++
	m.lastEmail = email
	m.lastCode = code
	m.lastPurpose = domain.OTPPurposePasswordReset
	return m.passwordResetErr
}

type allowAllLimiter struct{}

func (allowAllLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return true, 0
}

type denyAllLimiter struct{}

func (denyAllLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return false, time.Minute
}

func challengeKey(destination, purpose string) string {
	return destination + "|" + purpose
}

func timePtr(value time.Time) *time.Time {
	return &value
}

func stringPtr(value string) *string {
	return &value
}

func uuidPtr(value uuid.UUID) *uuid.UUID {
	return &value
}
