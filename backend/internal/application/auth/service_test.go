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
	svc, store, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "User@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	challenge, err := store.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
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

func TestVerifyRegistrationOTPSuccessCreatesUserAndSession(t *testing.T) {
	svc, store, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	phoneNumber := "+905551112233"
	gender := "female"
	birthDate := "1998-05-14"
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

	user, err := store.GetUserByEmail(context.Background(), "user@example.com")
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
	if !store.profiles[user.ID] {
		t.Fatal("expected profile to be created")
	}

	challenge, err := store.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
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
	svc, _, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	birthDate := "14-05-1998"
	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:     "user@example.com",
		OTP:       mailer.lastCode,
		Username:  "new_user",
		Password:  "super-secret-password",
		BirthDate: &birthDate,
	})
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
	svc, store, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:    "user@example.com",
		OTP:      "000000",
		Username: "user_one",
		Password: "super-secret-password",
	})
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)

	challenge, err := store.GetActiveOTPChallenge(context.Background(), "user@example.com", domain.OTPPurposeRegistration)
	if err != nil {
		t.Fatalf("GetActiveOTPChallenge() error = %v", err)
	}
	if challenge.AttemptCount != 1 {
		t.Fatalf("expected attempt count to increment, got %d", challenge.AttemptCount)
	}
}

func TestVerifyRegistrationOTPExpiredCodeRejected(t *testing.T) {
	svc, _, mailer, _, now := newTestService()
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	svc.now = func() time.Time { return now.Add(11 * time.Minute) }
	_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
		Email:    "user@example.com",
		OTP:      mailer.lastCode,
		Username: "user_one",
		Password: "super-secret-password",
	})
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)
}

func TestVerifyRegistrationOTPAttemptExhaustion(t *testing.T) {
	svc, _, _, _, now := newTestService()
	svc.otpMaxAttempts = 2
	svc.now = func() time.Time { return now }

	if err := svc.RequestRegistrationOTP(context.Background(), RequestOTPInput{Email: "user@example.com"}); err != nil {
		t.Fatalf("RequestRegistrationOTP() error = %v", err)
	}

	for i := 0; i < 2; i++ {
		_, err := svc.VerifyRegistrationOTP(context.Background(), VerifyRegistrationInput{
			Email:    "user@example.com",
			OTP:      "000000",
			Username: "user_one",
			Password: "super-secret-password",
		})
		if i == 0 {
			assertAppErrorCode(t, err, domain.ErrorCodeInvalidOTP)
			continue
		}
		assertAppErrorCode(t, err, domain.ErrorCodeOTPExhausted)
	}
}

func TestLoginWrongPasswordRejected(t *testing.T) {
	svc, store, _, _, now := newTestService()
	svc.now = func() time.Time { return now }

	passwordHash, err := svc.passwordHasher.Hash("correct-password")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	if _, err := store.CreateUser(context.Background(), domain.CreateUserParams{
		Username:        "existing_user",
		Email:           "existing@example.com",
		PasswordHash:    passwordHash,
		EmailVerifiedAt: now,
		Status:          domain.UserStatusActive,
	}); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	_, err = svc.Login(context.Background(), LoginInput{
		Username: "existing_user",
		Password: "wrong-password",
	})
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidCreds)
}

func TestRefreshRotatesTokenAndRejectsReuse(t *testing.T) {
	svc, store, mailer, refreshManager, now := newTestService()
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

	refreshed, err := svc.Refresh(context.Background(), session.RefreshToken, stringPtr("device"))
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if refreshed.RefreshToken == session.RefreshToken {
		t.Fatal("expected refresh rotation to issue a new refresh token")
	}

	oldHash := refreshManager.HashToken(session.RefreshToken)
	oldRecord, err := store.GetRefreshTokenByHash(context.Background(), oldHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash(old) error = %v", err)
	}
	if oldRecord.RevokedAt == nil || oldRecord.ReplacedByID == nil {
		t.Fatal("expected original refresh token to be revoked and linked to replacement")
	}

	_, err = svc.Refresh(context.Background(), session.RefreshToken, stringPtr("device"))
	assertAppErrorCode(t, err, domain.ErrorCodeRefreshReused)

	newHash := refreshManager.HashToken(refreshed.RefreshToken)
	newRecord, err := store.GetRefreshTokenByHash(context.Background(), newHash)
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
	svc, store, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := store.CreateUser(context.Background(), domain.CreateUserParams{
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
	if _, err := store.CreateRefreshToken(context.Background(), domain.CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  familyID,
		TokenHash: hash,
		CreatedAt: familyStartedAt,
		ExpiresAt: now.Add(24 * time.Hour),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	refreshed, err := svc.Refresh(context.Background(), plain, nil)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}

	newHash := refreshManager.HashToken(refreshed.RefreshToken)
	newRecord, err := store.GetRefreshTokenByHash(context.Background(), newHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash(new) error = %v", err)
	}
	expectedExpiry := familyStartedAt.Add(60 * 24 * time.Hour)
	if !newRecord.ExpiresAt.Equal(expectedExpiry) {
		t.Fatalf("expected absolute expiry %s, got %s", expectedExpiry, newRecord.ExpiresAt)
	}
}

func TestRefreshRejectsExpiredAbsoluteSession(t *testing.T) {
	svc, store, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := store.CreateUser(context.Background(), domain.CreateUserParams{
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
	if _, err := store.CreateRefreshToken(context.Background(), domain.CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  uuid.New(),
		TokenHash: hash,
		CreatedAt: now.Add(-60 * 24 * time.Hour),
		ExpiresAt: now.Add(time.Hour),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	_, err = svc.Refresh(context.Background(), plain, nil)
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidRefresh)
}

func TestRefreshExpiredTokenRejected(t *testing.T) {
	svc, store, _, refreshManager, now := newTestService()
	svc.now = func() time.Time { return now }

	user, err := store.CreateUser(context.Background(), domain.CreateUserParams{
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
	if _, err := store.CreateRefreshToken(context.Background(), domain.CreateRefreshTokenParams{
		UserID:    user.ID,
		FamilyID:  uuid.New(),
		TokenHash: hash,
		CreatedAt: now.Add(-2 * time.Hour),
		ExpiresAt: now.Add(-time.Minute),
	}); err != nil {
		t.Fatalf("CreateRefreshToken() error = %v", err)
	}

	_, err = svc.Refresh(context.Background(), plain, nil)
	assertAppErrorCode(t, err, domain.ErrorCodeInvalidRefresh)
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

func newTestService() (*Service, *fakeStore, *fakeMailer, *fakeRefreshTokenManager, time.Time) {
	store := newFakeStore()
	mailer := &fakeMailer{}
	refreshManager := &fakeRefreshTokenManager{}
	now := time.Date(2026, time.March, 21, 10, 0, 0, 0, time.UTC)
	service := NewService(
		store,
		fakeHasher{},
		fakeHasher{},
		fakeTokenIssuer{},
		refreshManager,
		fakeOTPGenerator{code: "123456"},
		mailer,
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
	return service, store, mailer, refreshManager, now
}

type fakeStore struct {
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

func newFakeStore() *fakeStore {
	return &fakeStore{
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

func (s *fakeStore) WithTx(_ context.Context, fn func(store domain.AuthStore) error) error {
	return fn(s)
}

func (s *fakeStore) GetUserByEmail(_ context.Context, email string) (*domain.User, error) {
	user, ok := s.usersByEmail[email]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (s *fakeStore) GetUserByUsername(_ context.Context, username string) (*domain.User, error) {
	user, ok := s.usersByUsername[username]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (s *fakeStore) GetUserByID(_ context.Context, userID uuid.UUID) (*domain.User, error) {
	user, ok := s.usersByID[userID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (s *fakeStore) CreateUser(_ context.Context, params domain.CreateUserParams) (*domain.User, error) {
	if _, exists := s.usersByEmail[params.Email]; exists {
		return nil, domain.ConflictError(domain.ErrorCodeEmailExists, "The email is already in use.")
	}
	if _, exists := s.usersByUsername[params.Username]; exists {
		return nil, domain.ConflictError(domain.ErrorCodeUsernameExists, "The username is already in use.")
	}
	if params.PhoneNumber != nil {
		if _, exists := s.phoneToUser[*params.PhoneNumber]; exists {
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
	s.usersByEmail[user.Email] = user
	s.usersByUsername[user.Username] = user
	s.usersByID[user.ID] = user
	if user.PhoneNumber != nil {
		s.phoneToUser[*user.PhoneNumber] = user.ID
	}
	return user, nil
}

func (s *fakeStore) CreateProfile(_ context.Context, userID uuid.UUID) error {
	s.profiles[userID] = true
	return nil
}

func (s *fakeStore) UpdateLastLogin(_ context.Context, userID uuid.UUID, lastLogin time.Time) error {
	user, ok := s.usersByID[userID]
	if !ok {
		return domain.ErrNotFound
	}
	user.LastLogin = timePtr(lastLogin)
	return nil
}

func (s *fakeStore) GetActiveOTPChallenge(_ context.Context, destination, purpose string) (*domain.OTPChallenge, error) {
	challenge, ok := s.challenges[challengeKey(destination, purpose)]
	if !ok || challenge.ConsumedAt != nil {
		return nil, domain.ErrNotFound
	}
	return challenge, nil
}

func (s *fakeStore) UpsertOTPChallenge(_ context.Context, params domain.UpsertOTPChallengeParams) (*domain.OTPChallenge, error) {
	key := challengeKey(params.Destination, params.Purpose)
	if existing, ok := s.challenges[key]; ok && existing.ConsumedAt == nil {
		existing.Channel = params.Channel
		existing.CodeHash = params.CodeHash
		existing.ExpiresAt = params.ExpiresAt
		existing.AttemptCount = 0
		existing.UpdatedAt = params.UpdatedAt
		return existing, nil
	}

	challenge := &domain.OTPChallenge{
		ID:           uuid.New(),
		Channel:      params.Channel,
		Destination:  params.Destination,
		Purpose:      params.Purpose,
		CodeHash:     params.CodeHash,
		ExpiresAt:    params.ExpiresAt,
		AttemptCount: 0,
		CreatedAt:    params.UpdatedAt,
		UpdatedAt:    params.UpdatedAt,
	}
	s.challenges[key] = challenge
	return challenge, nil
}

func (s *fakeStore) IncrementOTPChallengeAttempts(_ context.Context, challengeID uuid.UUID, updatedAt time.Time) (*domain.OTPChallenge, error) {
	for _, challenge := range s.challenges {
		if challenge.ID == challengeID {
			challenge.AttemptCount++
			challenge.UpdatedAt = updatedAt
			return challenge, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (s *fakeStore) ConsumeOTPChallenge(_ context.Context, challengeID uuid.UUID, consumedAt time.Time) error {
	for _, challenge := range s.challenges {
		if challenge.ID == challengeID {
			challenge.ConsumedAt = timePtr(consumedAt)
			challenge.UpdatedAt = consumedAt
			return nil
		}
	}
	return domain.ErrNotFound
}

func (s *fakeStore) CreateRefreshToken(_ context.Context, params domain.CreateRefreshTokenParams) (*domain.RefreshToken, error) {
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
	s.refreshByHash[record.TokenHash] = record
	s.refreshByID[record.ID] = record
	s.refreshByFamily[record.FamilyID] = append(s.refreshByFamily[record.FamilyID], record.ID)
	return record, nil
}

func (s *fakeStore) GetRefreshTokenByHash(_ context.Context, tokenHash string) (*domain.RefreshToken, error) {
	record, ok := s.refreshByHash[tokenHash]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return record, nil
}

func (s *fakeStore) GetRefreshTokenFamilyCreatedAt(_ context.Context, familyID uuid.UUID) (time.Time, error) {
	tokenIDs := s.refreshByFamily[familyID]
	if len(tokenIDs) == 0 {
		return time.Time{}, domain.ErrNotFound
	}

	createdAt := s.refreshByID[tokenIDs[0]].CreatedAt
	for _, tokenID := range tokenIDs[1:] {
		record := s.refreshByID[tokenID]
		if record.CreatedAt.Before(createdAt) {
			createdAt = record.CreatedAt
		}
	}
	return createdAt, nil
}

func (s *fakeStore) RevokeRefreshToken(_ context.Context, tokenID uuid.UUID, revokedAt time.Time) error {
	record, ok := s.refreshByID[tokenID]
	if !ok {
		return domain.ErrNotFound
	}
	record.RevokedAt = timePtr(revokedAt)
	record.UpdatedAt = revokedAt
	return nil
}

func (s *fakeStore) SetRefreshTokenReplacement(_ context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error {
	record, ok := s.refreshByID[tokenID]
	if !ok {
		return domain.ErrNotFound
	}
	record.ReplacedByID = uuidPtr(replacedByID)
	record.UpdatedAt = updatedAt
	return nil
}

func (s *fakeStore) RevokeRefreshTokenFamily(_ context.Context, familyID uuid.UUID, revokedAt time.Time) error {
	for _, tokenID := range s.refreshByFamily[familyID] {
		record := s.refreshByID[tokenID]
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
	plain := fmt.Sprintf("refresh-%d", m.counter)
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
	lastEmail string
	lastCode  string
}

func (m *fakeMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	m.lastEmail = email
	m.lastCode = code
	return nil
}

type allowAllLimiter struct{}

func (allowAllLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return true, 0
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
