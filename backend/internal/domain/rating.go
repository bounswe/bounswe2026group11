package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	RatingMin              = 1
	RatingMax              = 5
	RatingMessageMinLength = 10
	RatingMessageMaxLength = 100
	RatingWindowDuration   = 7 * 24 * time.Hour
)

// EventRating stores a participant's rating for an event.
type EventRating struct {
	ID                uuid.UUID
	ParticipantUserID uuid.UUID
	EventID           uuid.UUID
	Rating            int
	Message           *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// ParticipantRating stores a host's rating for a participant in an event.
type ParticipantRating struct {
	ID                uuid.UUID
	HostUserID        uuid.UUID
	ParticipantUserID uuid.UUID
	EventID           uuid.UUID
	Rating            int
	Message           *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// UserScore stores cached aggregate scores derived from rating tables.
type UserScore struct {
	UserID                 uuid.UUID
	ParticipantScore       *float64
	ParticipantRatingCount int
	HostedEventScore       *float64
	HostedEventRatingCount int
	FinalScore             *float64
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

// RatingWindow describes when rating mutations are allowed for an event.
type RatingWindow struct {
	OpensAt  time.Time
	ClosesAt time.Time
}

// NewRatingWindow builds the allowed rating interval for an event.
func NewRatingWindow(startTime time.Time, endTime *time.Time) RatingWindow {
	opensAt := startTime
	if endTime != nil {
		opensAt = *endTime
	}

	return RatingWindow{
		OpensAt:  opensAt,
		ClosesAt: opensAt.Add(RatingWindowDuration),
	}
}

// IsActive reports whether now falls inside the inclusive rating interval.
func (w RatingWindow) IsActive(now time.Time) bool {
	return !now.Before(w.OpensAt) && !now.After(w.ClosesAt)
}
