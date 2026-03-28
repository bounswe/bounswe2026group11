package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service implements the authentication use cases: OTP-based registration,
// forgot-password flows, password login, refresh-token rotation, and logout.
type Service struct {
	repo                    Repository
	passwordHasher          PasswordHasher
	otpHasher               PasswordHasher
	tokenIssuer             TokenIssuer
	refreshTokens           RefreshTokenManager
	otpGenerator            OTPCodeGenerator
	mailer                  OTPMailer
	otpRateLimiter          RateLimiter
	loginRateLimiter        RateLimiter
	availabilityRateLimiter RateLimiter
	now                     func() time.Time
	otpTTL                  time.Duration
	otpMaxAttempts          int
	otpResendCooldown       time.Duration
	refreshTokenTTL         time.Duration
	maxSessionTTL           time.Duration
}

var _ UseCase = (*Service)(nil)

// NewService constructs an auth Service with the given adapters and configuration.
func NewService(
	repo Repository,
	passwordHasher PasswordHasher,
	otpHasher PasswordHasher,
	tokenIssuer TokenIssuer,
	refreshTokens RefreshTokenManager,
	otpGenerator OTPCodeGenerator,
	mailer OTPMailer,
	otpRateLimiter RateLimiter,
	loginRateLimiter RateLimiter,
	availabilityRateLimiter RateLimiter,
	cfg Config,
) *Service {
	return &Service{
		repo:                    repo,
		passwordHasher:          passwordHasher,
		otpHasher:               otpHasher,
		tokenIssuer:             tokenIssuer,
		refreshTokens:           refreshTokens,
		otpGenerator:            otpGenerator,
		mailer:                  mailer,
		otpRateLimiter:          otpRateLimiter,
		loginRateLimiter:        loginRateLimiter,
		availabilityRateLimiter: availabilityRateLimiter,
		now:                     time.Now,
		otpTTL:                  cfg.OTPTTL,
		otpMaxAttempts:          cfg.OTPMaxAttempts,
		otpResendCooldown:       cfg.OTPResendCooldown,
		refreshTokenTTL:         cfg.RefreshTokenTTL,
		maxSessionTTL:           cfg.MaxSessionTTL,
	}
}

// RequestRegistrationOTP generates an OTP code, stores its hash, and mails the
// plaintext code to the user. If the email is already registered, the method
// returns nil silently to avoid leaking account-existence information.
func (s *Service) RequestRegistrationOTP(ctx context.Context, input RequestOTPInput) error {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return domain.ValidationError(map[string]string{"email": "must be a valid email address"})
	}

	now := s.now().UTC()
	if allowed, _ := s.otpRateLimiter.Allow(otpRateLimitKey(domain.OTPPurposeRegistration, email), now); !allowed {
		return domain.RateLimitedError("Too many requests. Try again later.")
	}

	existingUser, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return fmt.Errorf("lookup user by email: %w", err)
	}
	if err == nil && existingUser != nil {
		// Silently succeed to avoid revealing that a user with this email exists.
		return nil
	}

	return s.sendEmailOTPChallenge(
		ctx,
		now,
		nil,
		email,
		domain.OTPPurposeRegistration,
		s.mailer.SendRegistrationOTP,
		"send registration otp",
	)
}

// RequestPasswordResetOTP generates an OTP for password reset if the account
// exists. Unknown emails, resend cooldowns, and rate-limited requests all
// return nil so the caller cannot infer account existence.
func (s *Service) RequestPasswordResetOTP(ctx context.Context, input RequestOTPInput) error {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return domain.ValidationError(map[string]string{"email": "must be a valid email address"})
	}

	now := s.now().UTC()
	if allowed, _ := s.otpRateLimiter.Allow(otpRateLimitKey(domain.OTPPurposePasswordReset, email), now); !allowed {
		return nil
	}

	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("lookup user by email: %w", err)
	}

	if err := s.sendEmailOTPChallenge(
		ctx,
		now,
		&user.ID,
		email,
		domain.OTPPurposePasswordReset,
		s.mailer.SendPasswordResetOTP,
		"send password reset otp",
	); err != nil {
		if isAppErrorCode(err, domain.ErrorCodeRateLimited) {
			return nil
		}
		return err
	}

	return nil
}

// VerifyPasswordResetOTP validates a password-reset OTP and returns a short-lived
// reset token that authorizes the final password change step.
func (s *Service) VerifyPasswordResetOTP(ctx context.Context, input VerifyPasswordResetInput) (*PasswordResetGrant, error) {
	email, otp, appErr := validateEmailOTPInput(input.Email, input.OTP)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	challenge, err := s.verifyOTPChallenge(ctx, now, email, domain.OTPPurposePasswordReset, otp)
	if err != nil {
		return nil, err
	}

	resetToken, resetTokenHash, err := s.refreshTokens.NewToken()
	if err != nil {
		return nil, fmt.Errorf("generate password reset token: %w", err)
	}

	expiresAt := now.Add(s.otpTTL)
	err = s.repo.WithTx(ctx, func(repo Repository) error {
		if err := repo.ConsumeOTPChallenge(ctx, challenge.ID, now); err != nil {
			return fmt.Errorf("consume otp challenge: %w", err)
		}

		if _, err := repo.UpsertOTPChallenge(ctx, UpsertOTPChallengeParams{
			UserID:      challenge.UserID,
			Channel:     domain.OTPChannelEmail,
			Destination: email,
			Purpose:     domain.OTPPurposePasswordResetGrant,
			CodeHash:    resetTokenHash,
			ExpiresAt:   expiresAt,
			UpdatedAt:   now,
		}); err != nil {
			return fmt.Errorf("store password reset grant: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, mapRepoError(err)
	}

	return &PasswordResetGrant{
		ResetToken:       resetToken,
		ExpiresInSeconds: int64(expiresAt.Sub(now) / time.Second),
	}, nil
}

// ResetPassword finalizes a forgot-password flow using a previously issued
// password reset token and replaces the user's password hash.
func (s *Service) ResetPassword(ctx context.Context, input ResetPasswordInput) error {
	email, resetToken, newPassword, appErr := validateResetPasswordInput(input)
	if appErr != nil {
		return appErr
	}

	now := s.now().UTC()
	grant, err := s.repo.GetActiveOTPChallenge(ctx, email, domain.OTPPurposePasswordResetGrant)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return passwordResetTokenError()
		}
		return fmt.Errorf("lookup password reset grant: %w", err)
	}
	if grant.ConsumedAt != nil || now.After(grant.ExpiresAt.UTC()) {
		return passwordResetTokenError()
	}
	if s.refreshTokens.HashToken(resetToken) != grant.CodeHash {
		return passwordResetTokenError()
	}

	passwordHash, err := s.passwordHasher.Hash(newPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	err = s.repo.WithTx(ctx, func(repo Repository) error {
		userID, err := s.resolvePasswordResetUserID(ctx, repo, email, grant)
		if err != nil {
			return err
		}

		if err := repo.UpdatePassword(ctx, userID, passwordHash, now); err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return passwordResetTokenError()
			}
			return fmt.Errorf("update password: %w", err)
		}
		if err := repo.ConsumeOTPChallenge(ctx, grant.ID, now); err != nil {
			return fmt.Errorf("consume password reset grant: %w", err)
		}
		return nil
	})
	if err != nil {
		return mapRepoError(err)
	}

	return nil
}

// VerifyRegistrationOTP validates the OTP, creates the user and profile, marks
// the challenge as consumed, and issues a session — all within a single DB
// transaction to guarantee atomicity.
func (s *Service) VerifyRegistrationOTP(ctx context.Context, input VerifyRegistrationInput) (*Session, error) {
	email, username, password, phoneNumber, gender, birthDate, otp, appErr := validateVerifyRegistrationInput(input)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	challenge, err := s.verifyOTPChallenge(ctx, now, email, domain.OTPPurposeRegistration, otp)
	if err != nil {
		return nil, err
	}

	passwordHash, err := s.passwordHasher.Hash(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	var session *Session
	err = s.repo.WithTx(ctx, func(repo Repository) error {
		user, createErr := repo.CreateUser(ctx, CreateUserParams{
			Username:        username,
			Email:           email,
			PhoneNumber:     phoneNumber,
			Gender:          gender,
			BirthDate:       birthDate,
			PasswordHash:    passwordHash,
			EmailVerifiedAt: now,
			Status:          domain.UserStatusActive,
		})
		if createErr != nil {
			return createErr
		}

		if err := repo.CreateProfile(ctx, user.ID); err != nil {
			return fmt.Errorf("create profile: %w", err)
		}
		if err := repo.ConsumeOTPChallenge(ctx, challenge.ID, now); err != nil {
			return fmt.Errorf("consume otp challenge: %w", err)
		}

		sessionValue, err := s.issueSession(ctx, repo, *user, uuid.New(), input.DeviceInfo, now)
		if err != nil {
			return err
		}
		session = sessionValue
		return nil
	})
	if err != nil {
		return nil, mapRepoError(err)
	}

	return session, nil
}

// Login authenticates a user by username and password and returns a new session.
func (s *Service) Login(ctx context.Context, input LoginInput) (*Session, error) {
	username, password, appErr := validateLoginInput(input)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	if allowed, _ := s.loginRateLimiter.Allow(strings.ToLower(username), now); !allowed {
		return nil, domain.RateLimitedError("Too many requests. Try again later.")
	}

	user, err := s.repo.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password.")
		}
		return nil, fmt.Errorf("lookup user by username: %w", err)
	}

	// Use a constant-time comparison via bcrypt; also reject users with no password set.
	if user.PasswordHash == "" || s.passwordHasher.Compare(user.PasswordHash, password) != nil {
		return nil, domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password.")
	}

	var session *Session
	err = s.repo.WithTx(ctx, func(repo Repository) error {
		if err := repo.UpdateLastLogin(ctx, user.ID, now); err != nil {
			return fmt.Errorf("update last login: %w", err)
		}

		sessionValue, err := s.issueSession(ctx, repo, *user, uuid.New(), input.DeviceInfo, now)
		if err != nil {
			return err
		}
		session = sessionValue
		return nil
	})
	if err != nil {
		return nil, err
	}

	return session, nil
}

// Refresh performs refresh-token rotation: it validates the current token,
// issues a new access + refresh pair, revokes the old token, and links the
// old token to its replacement. If a revoked token is replayed, the entire
// token family is revoked to mitigate token theft.
func (s *Service) Refresh(ctx context.Context, refreshToken string, deviceInfo *string) (*Session, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return nil, domain.ValidationError(map[string]string{"refresh_token": "is required"})
	}

	now := s.now().UTC()
	tokenHash := s.refreshTokens.HashToken(refreshToken)

	var session *Session
	err := s.repo.WithTx(ctx, func(repo Repository) error {
		current, err := repo.GetRefreshTokenByHash(ctx, tokenHash)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token: %w", err)
		}

		// Reuse detection: if the token was already revoked, an attacker may
		// have stolen it. Revoke the entire family as a precaution.
		if current.RevokedAt != nil {
			if err := repo.RevokeRefreshTokenFamily(ctx, current.FamilyID, now); err != nil {
				return fmt.Errorf("revoke refresh token family: %w", err)
			}
			return domain.AuthError(domain.ErrorCodeRefreshReused, "The refresh token has already been used.")
		}
		if now.After(current.ExpiresAt.UTC()) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}

		user, err := repo.GetUserByID(ctx, current.UserID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup user by id: %w", err)
		}
		familyStartedAt, err := repo.GetRefreshTokenFamilyCreatedAt(ctx, current.FamilyID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token family start: %w", err)
		}
		// Enforce absolute session lifetime: no matter how many rotations
		// occur, the session cannot exceed maxSessionTTL from the first login.
		if !now.Before(familyStartedAt.UTC().Add(s.maxSessionTTL)) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}

		sessionValue, newToken, err := s.issueRotatedSession(ctx, repo, *user, current.FamilyID, familyStartedAt.UTC(), current.ID, deviceInfo, now)
		if err != nil {
			return err
		}
		if err := repo.RevokeRefreshToken(ctx, current.ID, now); err != nil {
			return fmt.Errorf("revoke previous refresh token: %w", err)
		}
		if err := repo.SetRefreshTokenReplacement(ctx, current.ID, newToken.ID, now); err != nil {
			return fmt.Errorf("set refresh token replacement: %w", err)
		}
		session = sessionValue
		return nil
	})
	if err != nil {
		return nil, err
	}

	return session, nil
}

// Logout revokes the presented refresh token, ending the session.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return domain.ValidationError(map[string]string{"refresh_token": "is required"})
	}

	now := s.now().UTC()
	tokenHash := s.refreshTokens.HashToken(refreshToken)
	return s.repo.WithTx(ctx, func(repo Repository) error {
		current, err := repo.GetRefreshTokenByHash(ctx, tokenHash)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token: %w", err)
		}
		if current.RevokedAt != nil || now.After(current.ExpiresAt.UTC()) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}
		if err := repo.RevokeRefreshToken(ctx, current.ID, now); err != nil {
			return fmt.Errorf("revoke refresh token: %w", err)
		}
		return nil
	})
}

// CheckAvailability reports whether the given username and email are available
// for registration. Both fields are required.
func (s *Service) CheckAvailability(ctx context.Context, input CheckAvailabilityInput) (*CheckAvailabilityResult, error) {
	email, username, appErr := validateRegistrationIdentity(input.Email, input.Username)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	clientKey := strings.TrimSpace(input.ClientKey)
	if clientKey == "" {
		clientKey = "unknown"
	}
	if allowed, _ := s.availabilityRateLimiter.Allow(clientKey, now); !allowed {
		return nil, domain.RateLimitedError("Too many requests. Try again later.")
	}

	result := &CheckAvailabilityResult{
		Username: "AVAILABLE",
		Email:    "AVAILABLE",
	}

	if _, err := s.repo.GetUserByUsername(ctx, username); err == nil {
		result.Username = "TAKEN"
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, fmt.Errorf("lookup user by username: %w", err)
	}

	if _, err := s.repo.GetUserByEmail(ctx, email); err == nil {
		result.Email = "TAKEN"
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, fmt.Errorf("lookup user by email: %w", err)
	}

	return result, nil
}

// issueSession creates a brand-new session (access + refresh tokens) for a fresh login.
func (s *Service) issueSession(
	ctx context.Context,
	repo Repository,
	user domain.User,
	familyID uuid.UUID,
	deviceInfo *string,
	issuedAt time.Time,
) (*Session, error) {
	session, _, err := s.issueRotatedSession(ctx, repo, user, familyID, issuedAt, uuid.Nil, deviceInfo, issuedAt)
	return session, err
}

// issueRotatedSession creates a new access + refresh token pair during rotation.
func (s *Service) issueRotatedSession(
	ctx context.Context,
	repo Repository,
	user domain.User,
	familyID uuid.UUID,
	familyStartedAt time.Time,
	_ uuid.UUID,
	deviceInfo *string,
	issuedAt time.Time,
) (*Session, *domain.RefreshToken, error) {
	accessToken, expiresInSeconds, err := s.tokenIssuer.IssueAccessToken(user, issuedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("issue access token: %w", err)
	}

	plainRefreshToken, refreshHash, err := s.refreshTokens.NewToken()
	if err != nil {
		return nil, nil, fmt.Errorf("generate refresh token: %w", err)
	}

	refreshRecord, err := repo.CreateRefreshToken(ctx, CreateRefreshTokenParams{
		UserID:     user.ID,
		FamilyID:   familyID,
		TokenHash:  refreshHash,
		CreatedAt:  issuedAt,
		ExpiresAt:  s.refreshExpiry(issuedAt, familyStartedAt),
		DeviceInfo: deviceInfo,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("create refresh token: %w", err)
	}

	return &Session{
		AccessToken:      accessToken,
		RefreshToken:     plainRefreshToken,
		TokenType:        "Bearer",
		ExpiresInSeconds: expiresInSeconds,
		User:             user.Summary(),
	}, refreshRecord, nil
}

// refreshExpiry returns the earlier of the per-token TTL and the absolute
// session deadline, preventing rotated tokens from extending beyond maxSessionTTL.
func (s *Service) refreshExpiry(issuedAt, familyStartedAt time.Time) time.Time {
	refreshExpiresAt := issuedAt.Add(s.refreshTokenTTL)
	absoluteExpiresAt := familyStartedAt.Add(s.maxSessionTTL)
	if refreshExpiresAt.After(absoluteExpiresAt) {
		return absoluteExpiresAt
	}
	return refreshExpiresAt
}

func (s *Service) sendEmailOTPChallenge(
	ctx context.Context,
	now time.Time,
	userID *uuid.UUID,
	email string,
	purpose string,
	send func(context.Context, string, string) error,
	sendLabel string,
) error {
	challenge, err := s.repo.GetActiveOTPChallenge(ctx, email, purpose)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return fmt.Errorf("lookup otp challenge: %w", err)
	}
	if err == nil && challenge != nil && now.Before(challenge.CreatedAt.UTC().Add(s.otpResendCooldown)) {
		// Enforce per-email cooldown to prevent OTP flooding.
		return domain.RateLimitedError("Too many requests. Try again later.")
	}

	code := s.otpGenerator.NewCode()
	codeHash, err := s.otpHasher.Hash(code)
	if err != nil {
		return fmt.Errorf("hash otp code: %w", err)
	}

	if _, err := s.repo.UpsertOTPChallenge(ctx, UpsertOTPChallengeParams{
		UserID:      userID,
		Channel:     domain.OTPChannelEmail,
		Destination: email,
		Purpose:     purpose,
		CodeHash:    codeHash,
		ExpiresAt:   now.Add(s.otpTTL),
		UpdatedAt:   now,
	}); err != nil {
		return fmt.Errorf("store otp challenge: %w", err)
	}

	if err := send(ctx, email, code); err != nil {
		return fmt.Errorf("%s: %w", sendLabel, err)
	}

	return nil
}

func (s *Service) verifyOTPChallenge(
	ctx context.Context,
	now time.Time,
	email string,
	purpose string,
	otp string,
) (*domain.OTPChallenge, error) {
	challenge, err := s.repo.GetActiveOTPChallenge(ctx, email, purpose)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
		}
		return nil, fmt.Errorf("lookup otp challenge: %w", err)
	}

	// Reject already-consumed or expired challenges before comparing the code.
	if challenge.ConsumedAt != nil || now.After(challenge.ExpiresAt.UTC()) {
		return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
	}
	if challenge.AttemptCount >= s.otpMaxAttempts {
		return nil, domain.AuthError(domain.ErrorCodeOTPExhausted, "The OTP can no longer be used. Request a new code.")
	}

	// On code mismatch, increment the attempt counter. If the max is reached,
	// the challenge becomes permanently exhausted and the user must request a new OTP.
	if err := s.otpHasher.Compare(challenge.CodeHash, otp); err != nil {
		updatedChallenge, incErr := s.repo.IncrementOTPChallengeAttempts(ctx, challenge.ID, now)
		if incErr != nil {
			return nil, fmt.Errorf("increment otp attempts: %w", incErr)
		}
		if updatedChallenge.AttemptCount >= s.otpMaxAttempts {
			return nil, domain.AuthError(domain.ErrorCodeOTPExhausted, "The OTP can no longer be used. Request a new code.")
		}
		return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
	}

	return challenge, nil
}

func (s *Service) resolvePasswordResetUserID(
	ctx context.Context,
	repo Repository,
	email string,
	grant *domain.OTPChallenge,
) (uuid.UUID, error) {
	if grant.UserID != nil {
		return *grant.UserID, nil
	}

	user, err := repo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return uuid.Nil, passwordResetTokenError()
		}
		return uuid.Nil, fmt.Errorf("lookup user by email: %w", err)
	}
	return user.ID, nil
}
