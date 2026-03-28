package domain

import (
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

var eventPrivacyLevels = map[string]EventPrivacyLevel{
	string(PrivacyPublic):    PrivacyPublic,
	string(PrivacyProtected): PrivacyProtected,
	string(PrivacyPrivate):   PrivacyPrivate,
}

var eventLocationTypes = map[string]EventLocationType{
	string(LocationPoint): LocationPoint,
	string(LocationRoute): LocationRoute,
}

var eventParticipantGenders = map[string]EventParticipantGender{
	string(GenderMale):   GenderMale,
	string(GenderFemale): GenderFemale,
	string(GenderOther):  GenderOther,
}

// ParseEventPrivacyLevel converts a wire string to an EventPrivacyLevel.
func ParseEventPrivacyLevel(value string) (EventPrivacyLevel, bool) {
	level, ok := eventPrivacyLevels[value]
	return level, ok
}

// ParseEventLocationType converts a wire string to an EventLocationType.
func ParseEventLocationType(value string) (EventLocationType, bool) {
	locationType, ok := eventLocationTypes[value]
	return locationType, ok
}

// ParseEventParticipantGender converts a wire string to an EventParticipantGender.
func ParseEventParticipantGender(value string) (EventParticipantGender, bool) {
	gender, ok := eventParticipantGenders[value]
	return gender, ok
}

// GeoPoint is a single WGS84 coordinate used for event locations.
type GeoPoint struct {
	Lat float64
	Lon float64
}

// Event is the core event entity.
type Event struct {
	ID                       uuid.UUID
	HostID                   uuid.UUID
	Title                    string
	Description              *string
	ImageURL                 *string
	CategoryID               *int
	StartTime                time.Time
	EndTime                  *time.Time
	PrivacyLevel             EventPrivacyLevel
	Status                   EventStatus
	Capacity                 *int
	ApprovedParticipantCount int
	MinimumAge               *int
	PreferredGender          *EventParticipantGender
	LocationType             *EventLocationType
	CreatedAt                time.Time
	UpdatedAt                time.Time
}
