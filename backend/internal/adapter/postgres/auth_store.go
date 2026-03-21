package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type AuthStore struct {
	pool *pgxpool.Pool
	db   execer
	tx   pgx.Tx
}

func NewAuthStore(pool *pgxpool.Pool) *AuthStore {
	return &AuthStore{
		pool: pool,
		db:   pool,
	}
}

func (s *AuthStore) WithTx(ctx context.Context, fn func(store domain.AuthStore) error) error {
	if s.tx != nil {
		return fn(s)
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	txStore := &AuthStore{
		pool: s.pool,
		db:   tx,
		tx:   tx,
	}

	if err := fn(txStore); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func (s *AuthStore) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, created_at, updated_at
		FROM app_user
		WHERE email = $1
	`, email)
	return scanUser(row)
}

func (s *AuthStore) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, created_at, updated_at
		FROM app_user
		WHERE username = $1
	`, username)
	return scanUser(row)
}

func (s *AuthStore) GetUserByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, created_at, updated_at
		FROM app_user
		WHERE id = $1
	`, userID)
	return scanUser(row)
}

func (s *AuthStore) CreateUser(ctx context.Context, params domain.CreateUserParams) (*domain.User, error) {
	row := s.db.QueryRow(ctx, `
		INSERT INTO app_user (username, email, phone_number, gender, birth_date, password_hash, email_verified_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, created_at, updated_at
	`, params.Username, params.Email, params.PhoneNumber, params.Gender, params.BirthDate, params.PasswordHash, params.EmailVerifiedAt, params.Status)

	user, err := scanUser(row)
	if err != nil {
		return nil, mapConstraintError(err)
	}
	return user, nil
}

func (s *AuthStore) CreateProfile(ctx context.Context, userID uuid.UUID) error {
	if _, err := s.db.Exec(ctx, `
		INSERT INTO profile (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, userID); err != nil {
		return fmt.Errorf("insert profile: %w", err)
	}
	return nil
}

func (s *AuthStore) UpdateLastLogin(ctx context.Context, userID uuid.UUID, lastLogin time.Time) error {
	if _, err := s.db.Exec(ctx, `
		UPDATE app_user
		SET last_login = $2, updated_at = $2
		WHERE id = $1
	`, userID, lastLogin); err != nil {
		return fmt.Errorf("update last_login: %w", err)
	}
	return nil
}

func (s *AuthStore) GetActiveOTPChallenge(ctx context.Context, destination, purpose string) (*domain.OTPChallenge, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
		FROM otp_challenge
		WHERE destination = $1 AND purpose = $2 AND consumed_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, destination, purpose)
	return scanOTPChallenge(row)
}

func (s *AuthStore) UpsertOTPChallenge(ctx context.Context, params domain.UpsertOTPChallengeParams) (*domain.OTPChallenge, error) {
	row := s.db.QueryRow(ctx, `
		INSERT INTO otp_challenge (channel, destination, purpose, code_hash, expires_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (destination, purpose) WHERE consumed_at IS NULL
		DO UPDATE SET
			channel = EXCLUDED.channel,
			code_hash = EXCLUDED.code_hash,
			expires_at = EXCLUDED.expires_at,
			attempt_count = 0,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
	`, params.Channel, params.Destination, params.Purpose, params.CodeHash, params.ExpiresAt, params.UpdatedAt)
	return scanOTPChallenge(row)
}

func (s *AuthStore) IncrementOTPChallengeAttempts(ctx context.Context, challengeID uuid.UUID, updatedAt time.Time) (*domain.OTPChallenge, error) {
	row := s.db.QueryRow(ctx, `
		UPDATE otp_challenge
		SET attempt_count = attempt_count + 1, updated_at = $2
		WHERE id = $1
		RETURNING id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
	`, challengeID, updatedAt)
	return scanOTPChallenge(row)
}

func (s *AuthStore) ConsumeOTPChallenge(ctx context.Context, challengeID uuid.UUID, consumedAt time.Time) error {
	if _, err := s.db.Exec(ctx, `
		UPDATE otp_challenge
		SET consumed_at = $2, updated_at = $2
		WHERE id = $1
	`, challengeID, consumedAt); err != nil {
		return fmt.Errorf("consume otp challenge: %w", err)
	}
	return nil
}

func (s *AuthStore) CreateRefreshToken(ctx context.Context, params domain.CreateRefreshTokenParams) (*domain.RefreshToken, error) {
	row := s.db.QueryRow(ctx, `
		INSERT INTO refresh_token (user_id, family_id, token_hash, expires_at, device_info, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, device_info, created_at, updated_at
	`, params.UserID, params.FamilyID, params.TokenHash, params.ExpiresAt, params.DeviceInfo, params.CreatedAt)
	return scanRefreshToken(row)
}

func (s *AuthStore) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	row := s.db.QueryRow(ctx, `
		SELECT id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, device_info, created_at, updated_at
		FROM refresh_token
		WHERE token_hash = $1
	`, tokenHash)
	return scanRefreshToken(row)
}

func (s *AuthStore) GetRefreshTokenFamilyCreatedAt(ctx context.Context, familyID uuid.UUID) (time.Time, error) {
	row := s.db.QueryRow(ctx, `
		SELECT MIN(created_at)
		FROM refresh_token
		WHERE family_id = $1
	`, familyID)

	var createdAt pgtype.Timestamptz
	if err := row.Scan(&createdAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, domain.ErrNotFound
		}
		return time.Time{}, err
	}
	if !createdAt.Valid {
		return time.Time{}, domain.ErrNotFound
	}
	return createdAt.Time, nil
}

func (s *AuthStore) RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID, revokedAt time.Time) error {
	if _, err := s.db.Exec(ctx, `
		UPDATE refresh_token
		SET revoked_at = COALESCE(revoked_at, $2), updated_at = $2
		WHERE id = $1
	`, tokenID, revokedAt); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

func (s *AuthStore) SetRefreshTokenReplacement(ctx context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error {
	if _, err := s.db.Exec(ctx, `
		UPDATE refresh_token
		SET replaced_by_id = $2, updated_at = $3
		WHERE id = $1
	`, tokenID, replacedByID, updatedAt); err != nil {
		return fmt.Errorf("set refresh token replacement: %w", err)
	}
	return nil
}

func (s *AuthStore) RevokeRefreshTokenFamily(ctx context.Context, familyID uuid.UUID, revokedAt time.Time) error {
	if _, err := s.db.Exec(ctx, `
		UPDATE refresh_token
		SET revoked_at = COALESCE(revoked_at, $2), updated_at = $2
		WHERE family_id = $1 AND revoked_at IS NULL
	`, familyID, revokedAt); err != nil {
		return fmt.Errorf("revoke refresh token family: %w", err)
	}
	return nil
}

func scanUser(row pgx.Row) (*domain.User, error) {
	var (
		user            domain.User
		phoneNumber     pgtype.Text
		gender          pgtype.Text
		birthDate       pgtype.Date
		passwordHash    pgtype.Text
		emailVerifiedAt pgtype.Timestamptz
		lastLogin       pgtype.Timestamptz
		status          pgtype.Text
	)

	if err := row.Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&phoneNumber,
		&gender,
		&birthDate,
		&passwordHash,
		&emailVerifiedAt,
		&lastLogin,
		&status,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	user.PhoneNumber = textPtr(phoneNumber)
	user.Gender = textPtr(gender)
	user.BirthDate = datePtr(birthDate)
	user.PasswordHash = textValue(passwordHash)
	user.EmailVerifiedAt = timestamptzPtr(emailVerifiedAt)
	user.LastLogin = timestamptzPtr(lastLogin)
	user.Status = textValue(status)
	return &user, nil
}

func scanOTPChallenge(row pgx.Row) (*domain.OTPChallenge, error) {
	var (
		challenge  domain.OTPChallenge
		userID     pgtype.UUID
		consumedAt pgtype.Timestamptz
	)

	if err := row.Scan(
		&challenge.ID,
		&userID,
		&challenge.Channel,
		&challenge.Destination,
		&challenge.Purpose,
		&challenge.CodeHash,
		&challenge.ExpiresAt,
		&consumedAt,
		&challenge.AttemptCount,
		&challenge.CreatedAt,
		&challenge.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	challenge.UserID = uuidPtr(userID)
	challenge.ConsumedAt = timestamptzPtr(consumedAt)
	return &challenge, nil
}

func scanRefreshToken(row pgx.Row) (*domain.RefreshToken, error) {
	var (
		token        domain.RefreshToken
		revokedAt    pgtype.Timestamptz
		replacedByID pgtype.UUID
		deviceInfo   pgtype.Text
	)

	if err := row.Scan(
		&token.ID,
		&token.UserID,
		&token.FamilyID,
		&token.TokenHash,
		&token.ExpiresAt,
		&revokedAt,
		&replacedByID,
		&deviceInfo,
		&token.CreatedAt,
		&token.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	token.RevokedAt = timestamptzPtr(revokedAt)
	token.ReplacedByID = uuidPtr(replacedByID)
	token.DeviceInfo = textPtr(deviceInfo)
	return &token, nil
}

func mapConstraintError(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}

	switch {
	case strings.Contains(pgErr.ConstraintName, "app_user_username_key"):
		return domain.ConflictError(domain.ErrorCodeUsernameExists, "The username is already in use.")
	case strings.Contains(pgErr.ConstraintName, "app_user_email_key"):
		return domain.ConflictError(domain.ErrorCodeEmailExists, "The email is already in use.")
	case strings.Contains(pgErr.ConstraintName, "idx_app_user_phone_unique"):
		return domain.ConflictError(domain.ErrorCodePhoneExists, "The phone number is already in use.")
	default:
		return err
	}
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	text := value.String
	return &text
}

func textValue(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func datePtr(value pgtype.Date) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time
	return &t
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time
	return &t
}

func uuidPtr(value pgtype.UUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	id := uuid.UUID(value.Bytes)
	return &id
}
