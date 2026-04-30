package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthRepository is the Postgres-backed implementation of auth.Repository.
type AuthRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewAuthRepository returns a repository that executes queries against the given connection pool.
func NewAuthRepository(pool *pgxpool.Pool) *AuthRepository {
	return &AuthRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// NewAuthRepositoryWithTx returns a repository bound to an existing transaction.
// Repository methods use tx as the default runner when no ambient transaction exists.
func NewAuthRepositoryWithTx(pool *pgxpool.Pool, tx pgx.Tx) *AuthRepository {
	return &AuthRepository{
		pool: pool,
		db:   contextualRunner{fallback: tx},
	}
}

func (r *AuthRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, role, created_at, updated_at
		FROM app_user
		WHERE email = $1
	`, email)
	return scanUser(row)
}

func (r *AuthRepository) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, role, created_at, updated_at
		FROM app_user
		WHERE username = $1
	`, username)
	return scanUser(row)
}

func (r *AuthRepository) GetUserByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, role, created_at, updated_at
		FROM app_user
		WHERE id = $1
	`, userID)
	return scanUser(row)
}

func (r *AuthRepository) CreateUser(ctx context.Context, params authapp.CreateUserParams) (*domain.User, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO app_user (username, email, phone_number, gender, birth_date, password_hash, email_verified_at, status, role)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, username, email, phone_number, gender, birth_date, password_hash, email_verified_at, last_login, status, role, created_at, updated_at
	`, params.Username, params.Email, params.PhoneNumber, params.Gender, params.BirthDate, params.PasswordHash, params.EmailVerifiedAt, params.Status, domain.UserRoleUser)

	user, err := scanUser(row)
	if err != nil {
		return nil, mapConstraintError(err)
	}
	return user, nil
}

func (r *AuthRepository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error {
	result, err := r.db.Exec(ctx, `
		UPDATE app_user
		SET password_hash = $2, updated_at = $3
		WHERE id = $1
	`, userID, passwordHash, updatedAt)
	if err != nil {
		return fmt.Errorf("update password_hash: %w", err)
	}
	if result.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AuthRepository) CreateProfile(ctx context.Context, userID uuid.UUID) error {
	if _, err := r.db.Exec(ctx, `
		INSERT INTO profile (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, userID); err != nil {
		return fmt.Errorf("insert profile: %w", err)
	}
	return nil
}

func (r *AuthRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID, lastLogin time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE app_user
		SET last_login = $2, updated_at = $2
		WHERE id = $1
	`, userID, lastLogin); err != nil {
		return fmt.Errorf("update last_login: %w", err)
	}
	return nil
}

func (r *AuthRepository) GetActiveOTPChallenge(ctx context.Context, destination, purpose string) (*domain.OTPChallenge, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
		FROM otp_challenge
		WHERE destination = $1 AND purpose = $2 AND consumed_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, destination, purpose)
	return scanOTPChallenge(row)
}

func (r *AuthRepository) UpsertOTPChallenge(ctx context.Context, params authapp.UpsertOTPChallengeParams) (*domain.OTPChallenge, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO otp_challenge (user_id, channel, destination, purpose, code_hash, expires_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (destination, purpose) WHERE consumed_at IS NULL
		DO UPDATE SET
			user_id = EXCLUDED.user_id,
			channel = EXCLUDED.channel,
			code_hash = EXCLUDED.code_hash,
			expires_at = EXCLUDED.expires_at,
			attempt_count = 0,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
	`, params.UserID, params.Channel, params.Destination, params.Purpose, params.CodeHash, params.ExpiresAt, params.UpdatedAt)
	return scanOTPChallenge(row)
}

func (r *AuthRepository) IncrementOTPChallengeAttempts(ctx context.Context, challengeID uuid.UUID, updatedAt time.Time) (*domain.OTPChallenge, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE otp_challenge
		SET attempt_count = attempt_count + 1, updated_at = $2
		WHERE id = $1
		RETURNING id, user_id, channel, destination, purpose, code_hash, expires_at, consumed_at, attempt_count, created_at, updated_at
	`, challengeID, updatedAt)
	return scanOTPChallenge(row)
}

func (r *AuthRepository) ConsumeOTPChallenge(ctx context.Context, challengeID uuid.UUID, consumedAt time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE otp_challenge
		SET consumed_at = $2, updated_at = $2
		WHERE id = $1
	`, challengeID, consumedAt); err != nil {
		return fmt.Errorf("consume otp challenge: %w", err)
	}
	return nil
}

func (r *AuthRepository) CreateRefreshToken(ctx context.Context, params authapp.CreateRefreshTokenParams) (*domain.RefreshToken, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO refresh_token (user_id, family_id, token_hash, expires_at, device_info, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, device_info, created_at, updated_at
	`, params.UserID, params.FamilyID, params.TokenHash, params.ExpiresAt, params.DeviceInfo, params.CreatedAt)
	return scanRefreshToken(row)
}

func (r *AuthRepository) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, device_info, created_at, updated_at
		FROM refresh_token
		WHERE token_hash = $1
	`, tokenHash)
	return scanRefreshToken(row)
}

func (r *AuthRepository) GetRefreshTokenFamilyCreatedAt(ctx context.Context, familyID uuid.UUID) (time.Time, error) {
	row := r.db.QueryRow(ctx, `
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

func (r *AuthRepository) RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID, revokedAt time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE refresh_token
		SET revoked_at = COALESCE(revoked_at, $2), updated_at = $2
		WHERE id = $1
	`, tokenID, revokedAt); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

func (r *AuthRepository) SetRefreshTokenReplacement(ctx context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE refresh_token
		SET replaced_by_id = $2, updated_at = $3
		WHERE id = $1
	`, tokenID, replacedByID, updatedAt); err != nil {
		return fmt.Errorf("set refresh token replacement: %w", err)
	}
	return nil
}

func (r *AuthRepository) RevokeRefreshTokenFamily(ctx context.Context, familyID uuid.UUID, revokedAt time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE refresh_token
		SET revoked_at = COALESCE(revoked_at, $2), updated_at = $2
		WHERE family_id = $1 AND revoked_at IS NULL
	`, familyID, revokedAt); err != nil {
		return fmt.Errorf("revoke refresh token family: %w", err)
	}
	return nil
}

// mapConstraintError translates Postgres unique-violation errors (code 23505)
// into domain-level ConflictErrors so the HTTP layer returns 409 instead of 500.
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
