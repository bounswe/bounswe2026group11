package rating

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UpsertRatingInput carries the write payload used by both rating resources.
type UpsertRatingInput struct {
	Rating  int
	Message *string
}

// RatingResult is the shared API-facing payload for rating resources.
type RatingResult struct {
	ID        string    `json:"id"`
	Rating    int       `json:"rating"`
	Message   *string   `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Settings contains the score calculation parameters for Bayesian smoothing.
type Settings struct {
	GlobalPrior float64
	BayesianM   int
}

// EventRatingContext contains the event and participation state required to
// authorize participant -> event ratings.
type EventRatingContext struct {
	EventID               uuid.UUID
	HostUserID            uuid.UUID
	Status                domain.EventStatus
	StartTime             time.Time
	EndTime               *time.Time
	IsRequestingHost      bool
	IsApprovedParticipant bool
}

// ParticipantRatingContext contains the event and participation state required
// to authorize host -> participant ratings.
type ParticipantRatingContext struct {
	EventID               uuid.UUID
	HostUserID            uuid.UUID
	ParticipantUserID     uuid.UUID
	Status                domain.EventStatus
	StartTime             time.Time
	EndTime               *time.Time
	IsRequestingHost      bool
	IsApprovedParticipant bool
}

// UpsertEventRatingParams carries the data needed to persist an event rating.
type UpsertEventRatingParams struct {
	EventID           uuid.UUID
	ParticipantUserID uuid.UUID
	Rating            int
	Message           *string
}

// UpsertParticipantRatingParams carries the data needed to persist a
// participant rating.
type UpsertParticipantRatingParams struct {
	EventID           uuid.UUID
	HostUserID        uuid.UUID
	ParticipantUserID uuid.UUID
	Rating            int
	Message           *string
}

// ScoreAggregate is the raw aggregate read from one rating source.
type ScoreAggregate struct {
	Average *float64
	Count   int
}

// UpsertUserScoreParams carries the derived score snapshot to cache for a user.
type UpsertUserScoreParams struct {
	UserID                 uuid.UUID
	ParticipantScore       *float64
	ParticipantRatingCount int
	HostedEventScore       *float64
	HostedEventRatingCount int
	FinalScore             *float64
}
