package auth

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)
var otpPattern = regexp.MustCompile(`^[0-9]{6}$`)

type Service struct {
	store             domain.AuthStore
	passwordHasher    domain.PasswordHasher
	otpHasher         domain.PasswordHasher
	tokenIssuer       domain.TokenIssuer
	refreshTokens     domain.RefreshTokenManager
	otpGenerator      domain.OTPCodeGenerator
	mailer            domain.OTPMailer
	otpRateLimiter    domain.RateLimiter
	loginRateLimiter  domain.RateLimiter
	now               func() time.Time
	otpTTL            time.Duration
	otpMaxAttempts    int
	otpResendCooldown time.Duration
	refreshTokenTTL   time.Duration
	maxSessionTTL     time.Duration
}

type Config struct {
	OTPTTL            time.Duration
	OTPMaxAttempts    int
	OTPResendCooldown time.Duration
	RefreshTokenTTL   time.Duration
	MaxSessionTTL     time.Duration
}

type RequestOTPInput struct {
	Email string
}

type VerifyRegistrationInput struct {
	Email       string
	OTP         string
	Username    string
	Password    string
	PhoneNumber *string
	Gender      *string
	BirthDate   *string
	DeviceInfo  *string
}

type LoginInput struct {
	Username   string
	Password   string
	DeviceInfo *string
}

type Session struct {
	AccessToken      string             `json:"access_token"`
	RefreshToken     string             `json:"refresh_token"`
	TokenType        string             `json:"token_type"`
	ExpiresInSeconds int64              `json:"expires_in_seconds"`
	User             domain.UserSummary `json:"user"`
}

func NewService(
	store domain.AuthStore,
	passwordHasher domain.PasswordHasher,
	otpHasher domain.PasswordHasher,
	tokenIssuer domain.TokenIssuer,
	refreshTokens domain.RefreshTokenManager,
	otpGenerator domain.OTPCodeGenerator,
	mailer domain.OTPMailer,
	otpRateLimiter domain.RateLimiter,
	loginRateLimiter domain.RateLimiter,
	cfg Config,
) *Service {
	return &Service{
		store:             store,
		passwordHasher:    passwordHasher,
		otpHasher:         otpHasher,
		tokenIssuer:       tokenIssuer,
		refreshTokens:     refreshTokens,
		otpGenerator:      otpGenerator,
		mailer:            mailer,
		otpRateLimiter:    otpRateLimiter,
		loginRateLimiter:  loginRateLimiter,
		now:               time.Now,
		otpTTL:            cfg.OTPTTL,
		otpMaxAttempts:    cfg.OTPMaxAttempts,
		otpResendCooldown: cfg.OTPResendCooldown,
		refreshTokenTTL:   cfg.RefreshTokenTTL,
		maxSessionTTL:     cfg.MaxSessionTTL,
	}
}

func (s *Service) RequestRegistrationOTP(ctx context.Context, input RequestOTPInput) error {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return domain.ValidationError(map[string]string{"email": "must be a valid email address"})
	}

	now := s.now().UTC()
	if allowed, _ := s.otpRateLimiter.Allow(email, now); !allowed {
		return domain.RateLimitedError("Too many requests. Try again later.")
	}

	existingUser, err := s.store.GetUserByEmail(ctx, email)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return fmt.Errorf("lookup user by email: %w", err)
	}
	if err == nil && existingUser != nil {
		return nil
	}

	challenge, err := s.store.GetActiveOTPChallenge(ctx, email, domain.OTPPurposeRegistration)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return fmt.Errorf("lookup otp challenge: %w", err)
	}
	if err == nil && challenge != nil && now.Before(challenge.CreatedAt.UTC().Add(s.otpResendCooldown)) {
		return domain.RateLimitedError("Too many requests. Try again later.")
	}

	code := s.otpGenerator.NewCode()
	codeHash, err := s.otpHasher.Hash(code)
	if err != nil {
		return fmt.Errorf("hash otp code: %w", err)
	}

	if _, err := s.store.UpsertOTPChallenge(ctx, domain.UpsertOTPChallengeParams{
		Channel:     domain.OTPChannelEmail,
		Destination: email,
		Purpose:     domain.OTPPurposeRegistration,
		CodeHash:    codeHash,
		ExpiresAt:   now.Add(s.otpTTL),
		UpdatedAt:   now,
	}); err != nil {
		return fmt.Errorf("store otp challenge: %w", err)
	}

	if err := s.mailer.SendRegistrationOTP(ctx, email, code); err != nil {
		return fmt.Errorf("send registration otp: %w", err)
	}

	return nil
}

func (s *Service) VerifyRegistrationOTP(ctx context.Context, input VerifyRegistrationInput) (*Session, error) {
	email, username, password, phoneNumber, gender, birthDate, otp, appErr := validateVerifyRegistrationInput(input)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	challenge, err := s.store.GetActiveOTPChallenge(ctx, email, domain.OTPPurposeRegistration)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
		}
		return nil, fmt.Errorf("lookup otp challenge: %w", err)
	}

	if challenge.ConsumedAt != nil || now.After(challenge.ExpiresAt.UTC()) {
		return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
	}
	if challenge.AttemptCount >= s.otpMaxAttempts {
		return nil, domain.AuthError(domain.ErrorCodeOTPExhausted, "The OTP can no longer be used. Request a new code.")
	}

	if err := s.otpHasher.Compare(challenge.CodeHash, otp); err != nil {
		updatedChallenge, incErr := s.store.IncrementOTPChallengeAttempts(ctx, challenge.ID, now)
		if incErr != nil {
			return nil, fmt.Errorf("increment otp attempts: %w", incErr)
		}
		if updatedChallenge.AttemptCount >= s.otpMaxAttempts {
			return nil, domain.AuthError(domain.ErrorCodeOTPExhausted, "The OTP can no longer be used. Request a new code.")
		}
		return nil, domain.AuthError(domain.ErrorCodeInvalidOTP, "The OTP is invalid or has expired.")
	}

	passwordHash, err := s.passwordHasher.Hash(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	var session *Session
	err = s.store.WithTx(ctx, func(store domain.AuthStore) error {
		user, createErr := store.CreateUser(ctx, domain.CreateUserParams{
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

		if err := store.CreateProfile(ctx, user.ID); err != nil {
			return fmt.Errorf("create profile: %w", err)
		}
		if err := store.ConsumeOTPChallenge(ctx, challenge.ID, now); err != nil {
			return fmt.Errorf("consume otp challenge: %w", err)
		}

		sessionValue, err := s.issueSession(ctx, store, *user, uuid.New(), input.DeviceInfo, now)
		if err != nil {
			return err
		}
		session = sessionValue
		return nil
	})
	if err != nil {
		return nil, mapStoreError(err)
	}

	return session, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (*Session, error) {
	username, password, appErr := validateLoginInput(input)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	if allowed, _ := s.loginRateLimiter.Allow(strings.ToLower(username), now); !allowed {
		return nil, domain.RateLimitedError("Too many requests. Try again later.")
	}

	user, err := s.store.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password.")
		}
		return nil, fmt.Errorf("lookup user by username: %w", err)
	}

	if user.PasswordHash == "" || s.passwordHasher.Compare(user.PasswordHash, password) != nil {
		return nil, domain.AuthError(domain.ErrorCodeInvalidCreds, "Invalid username or password.")
	}

	var session *Session
	err = s.store.WithTx(ctx, func(store domain.AuthStore) error {
		if err := store.UpdateLastLogin(ctx, user.ID, now); err != nil {
			return fmt.Errorf("update last login: %w", err)
		}

		sessionValue, err := s.issueSession(ctx, store, *user, uuid.New(), input.DeviceInfo, now)
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

func (s *Service) Refresh(ctx context.Context, refreshToken string, deviceInfo *string) (*Session, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return nil, domain.ValidationError(map[string]string{"refresh_token": "is required"})
	}

	now := s.now().UTC()
	tokenHash := s.refreshTokens.HashToken(refreshToken)

	var session *Session
	err := s.store.WithTx(ctx, func(store domain.AuthStore) error {
		current, err := store.GetRefreshTokenByHash(ctx, tokenHash)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token: %w", err)
		}

		if current.RevokedAt != nil {
			if err := store.RevokeRefreshTokenFamily(ctx, current.FamilyID, now); err != nil {
				return fmt.Errorf("revoke refresh token family: %w", err)
			}
			return domain.AuthError(domain.ErrorCodeRefreshReused, "The refresh token has already been used.")
		}
		if now.After(current.ExpiresAt.UTC()) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}

		user, err := store.GetUserByID(ctx, current.UserID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup user by id: %w", err)
		}
		familyStartedAt, err := store.GetRefreshTokenFamilyCreatedAt(ctx, current.FamilyID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token family start: %w", err)
		}
		if !now.Before(familyStartedAt.UTC().Add(s.maxSessionTTL)) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}

		sessionValue, newToken, err := s.issueRotatedSession(ctx, store, *user, current.FamilyID, familyStartedAt.UTC(), current.ID, deviceInfo, now)
		if err != nil {
			return err
		}
		if err := store.RevokeRefreshToken(ctx, current.ID, now); err != nil {
			return fmt.Errorf("revoke previous refresh token: %w", err)
		}
		if err := store.SetRefreshTokenReplacement(ctx, current.ID, newToken.ID, now); err != nil {
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

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return domain.ValidationError(map[string]string{"refresh_token": "is required"})
	}

	now := s.now().UTC()
	tokenHash := s.refreshTokens.HashToken(refreshToken)
	return s.store.WithTx(ctx, func(store domain.AuthStore) error {
		current, err := store.GetRefreshTokenByHash(ctx, tokenHash)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
			}
			return fmt.Errorf("lookup refresh token: %w", err)
		}
		if current.RevokedAt != nil || now.After(current.ExpiresAt.UTC()) {
			return domain.AuthError(domain.ErrorCodeInvalidRefresh, "The refresh token is invalid or expired.")
		}
		if err := store.RevokeRefreshToken(ctx, current.ID, now); err != nil {
			return fmt.Errorf("revoke refresh token: %w", err)
		}
		return nil
	})
}

func (s *Service) issueSession(
	ctx context.Context,
	store domain.AuthStore,
	user domain.User,
	familyID uuid.UUID,
	deviceInfo *string,
	issuedAt time.Time,
) (*Session, error) {
	session, _, err := s.issueRotatedSession(ctx, store, user, familyID, issuedAt, uuid.Nil, deviceInfo, issuedAt)
	return session, err
}

func (s *Service) issueRotatedSession(
	ctx context.Context,
	store domain.AuthStore,
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

	refreshRecord, err := store.CreateRefreshToken(ctx, domain.CreateRefreshTokenParams{
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

func (s *Service) refreshExpiry(issuedAt, familyStartedAt time.Time) time.Time {
	refreshExpiresAt := issuedAt.Add(s.refreshTokenTTL)
	absoluteExpiresAt := familyStartedAt.Add(s.maxSessionTTL)
	if refreshExpiresAt.After(absoluteExpiresAt) {
		return absoluteExpiresAt
	}
	return refreshExpiresAt
}

func validateVerifyRegistrationInput(input VerifyRegistrationInput) (email, username, password string, phoneNumber, gender *string, birthDate *time.Time, otp string, appErr *domain.AppError) {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return "", "", "", nil, nil, nil, "", domain.ValidationError(map[string]string{"email": "must be a valid email address"})
	}

	username = strings.TrimSpace(input.Username)
	password = input.Password
	otp = strings.TrimSpace(input.OTP)

	details := make(map[string]string)
	if len(username) < 3 || len(username) > 32 || !usernamePattern.MatchString(username) {
		details["username"] = "must be 3-32 characters using letters, numbers, or underscores"
	}
	if len(password) < 8 || len(password) > 128 {
		details["password"] = "must be between 8 and 128 characters"
	}
	if !otpPattern.MatchString(otp) {
		details["otp"] = "must be a 6-digit code"
	}
	phoneNumber = sanitizePhoneNumber(input.PhoneNumber, details)
	gender = sanitizeOptionalText(input.Gender, "gender", 32, details)
	birthDate = sanitizeBirthDate(input.BirthDate, details)
	if len(details) > 0 {
		return "", "", "", nil, nil, nil, "", domain.ValidationError(details)
	}

	return email, username, password, phoneNumber, gender, birthDate, otp, nil
}

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

func sanitizeOptionalText(value *string, field string, maxLength int, details map[string]string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	if len(trimmed) > maxLength {
		details[field] = fmt.Sprintf("must be at most %d characters", maxLength)
		return nil
	}
	return &trimmed
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

func mapStoreError(err error) error {
	var appErr *domain.AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return err
}
