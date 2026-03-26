package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// EventPrivacyLevel defines who can discover and join an event.
type EventPrivacyLevel string

// EventLocationType defines how location geometry is represented.
type EventLocationType string

// EventParticipantGender defines optional participant preference filters.
type EventParticipantGender string

// EventStatus defines the lifecycle state of an event.
type EventStatus string

// Accepted values for event fields.
const (
	PrivacyPublic    EventPrivacyLevel = "PUBLIC"
	PrivacyProtected EventPrivacyLevel = "PROTECTED"
	PrivacyPrivate   EventPrivacyLevel = "PRIVATE"

	LocationPoint EventLocationType = "POINT"
	LocationRoute EventLocationType = "ROUTE"

	GenderMale   EventParticipantGender = "MALE"
	GenderFemale EventParticipantGender = "FEMALE"
	GenderOther  EventParticipantGender = "OTHER"

	EventStatusActive EventStatus = "ACTIVE"

	MaxEventTags        = 5
	MaxEventConstraints = 5
	MaxTagLength        = 20
	MinRoutePoints      = 2
)

// GeoPoint is a single WGS84 coordinate used for event locations.
type GeoPoint struct {
	Lat float64
	Lon float64
}

// Event is the core event entity.
type Event struct {
	ID              uuid.UUID
	HostID          uuid.UUID
	Title           string
	Description     *string
	ImageURL        *string
	CategoryID      *int
	StartTime       time.Time
	EndTime         *time.Time
	PrivacyLevel    EventPrivacyLevel
	Status          EventStatus
	Capacity        *int
	MinimumAge      *int
	PreferredGender *EventParticipantGender
	LocationType    *EventLocationType
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

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
	PrivacyLevel    EventPrivacyLevel
	Capacity        *int
	MinimumAge      *int
	PreferredGender *EventParticipantGender
	LocationType    EventLocationType
	Address         *string
	Point           *GeoPoint
	RoutePoints     []GeoPoint
	Tags            []string
	Constraints     []EventConstraintParams
}

// EventConstraintParams is a single constraint to attach to an event.
type EventConstraintParams struct {
	Type string
	Info string
}

// EventRepository is the driven port for event persistence.
type EventRepository interface {
	CreateEvent(ctx context.Context, params CreateEventParams) (*Event, error)
}
