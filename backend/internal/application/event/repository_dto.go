package event

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// CreateEventParams carries all data needed to persist a new event and its
// related location, tags, and constraints in a single transaction.
type CreateEventParams struct {
	HostID          uuid.UUID
	Title           string
	Description     string
	ImageURL        *string
	CategoryID      int
	StartTime       time.Time
	EndTime         *time.Time
	PrivacyLevel    domain.EventPrivacyLevel
	Capacity        *int
	MinimumAge      *int
	PreferredGender *domain.EventParticipantGender
	LocationType    domain.EventLocationType
	Address         *string
	Point           *domain.GeoPoint
	RoutePoints     []domain.GeoPoint
	Tags            []string
	Constraints     []EventConstraintParams
}

// EventConstraintParams is a single constraint to attach to an event.
type EventConstraintParams struct {
	Type string
	Info string
}
