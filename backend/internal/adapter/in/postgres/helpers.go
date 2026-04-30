package postgres

import (
	"errors"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// scanUser reads a User from a single pgx.Row, handling nullable columns
// via pgtype intermediaries. Returns domain.ErrNotFound if no row exists.
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
		role            string
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
		&role,
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
	user.Status = domain.UserStatus(textValue(status))
	user.Role = domain.UserRole(role)
	return &user, nil
}

// scanOTPChallenge reads an OTPChallenge from a single pgx.Row.
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

// scanRefreshToken reads a RefreshToken from a single pgx.Row.
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

// textPtr converts a nullable pgtype.Text to a *string (nil if SQL NULL).
func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return new(value.String)
}

// textValue converts a nullable pgtype.Text to a plain string ("" if SQL NULL).
func textValue(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

// datePtr converts a nullable pgtype.Date to a *time.Time.
func datePtr(value pgtype.Date) *time.Time {
	if !value.Valid {
		return nil
	}
	return new(value.Time)
}

// timestamptzPtr converts a nullable pgtype.Timestamptz to a *time.Time.
func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return new(value.Time)
}

// uuidPtr converts a nullable pgtype.UUID to a *uuid.UUID.
func uuidPtr(value pgtype.UUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	return new(uuid.UUID(value.Bytes))
}
